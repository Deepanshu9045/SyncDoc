import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getDocumentMemberRole } from "@/lib/auth/rbac";
import { Role } from "@prisma/client";
import * as Y from "yjs";
import { z } from "zod";

const restoreSchema = z.object({
  versionId: z.string().uuid("Invalid version ID"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const role = await getDocumentMemberRole(documentId, userId);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const versionId = searchParams.get("versionId");

    // If requesting a specific snapshot's content
    if (versionId) {
      const version = await prisma.documentVersion.findUnique({
        where: { id: versionId },
      });

      if (!version || version.documentId !== documentId) {
        return NextResponse.json({ error: "Version not found" }, { status: 404 });
      }

      // Reconstruct document from snapshot to extract content text
      const tempYdoc = new Y.Doc();
      Y.applyUpdate(tempYdoc, version.snapshot);
      const content = tempYdoc.getText("default").toString();

      return NextResponse.json({
        id: version.id,
        createdAt: version.createdAt,
        content,
      });
    }

    // Otherwise return list of snapshots (without large binary blob)
    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      versions.map((v) => ({
        id: v.id,
        documentId: v.documentId,
        createdBy: v.createdBy,
        creator: v.creator,
        createdAt: v.createdAt,
      }))
    );
  } catch (error) {
    console.error("Get versions list error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const role = await getDocumentMemberRole(documentId, userId);
  if (!role || role === Role.VIEWER) {
    return NextResponse.json(
      { error: "Forbidden. Viewers cannot create snapshots." },
      { status: 403 }
    );
  }

  try {
    // 1. Rebuild the server document state
    const operations = await prisma.documentOperation.findMany({
      where: { documentId },
      orderBy: { vectorClock: "asc" },
    });

    const serverYdoc = new Y.Doc();
    for (const op of operations) {
      Y.applyUpdate(serverYdoc, op.operationData);
    }

    // 2. Encode current state vector as binary snapshot update
    const snapshotBinary = Y.encodeStateAsUpdate(serverYdoc);

    // 3. Persist new snapshot version
    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        snapshot: Buffer.from(snapshotBinary),
        createdBy: userId,
      },
    });

    return NextResponse.json({
      id: version.id,
      createdAt: version.createdAt,
      success: true,
    });
  } catch (error) {
    console.error("Create version snapshot error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  // Restoring versions is OWNER only
  const role = await getDocumentMemberRole(documentId, userId);
  if (role !== Role.OWNER) {
    return NextResponse.json(
      { error: "Forbidden. Only owners can restore previous versions." },
      { status: 403 }
    );
  }

  try {
    const json = await req.json();
    const payload = restoreSchema.parse(json);

    const version = await prisma.documentVersion.findUnique({
      where: { id: payload.versionId },
    });

    if (!version || version.documentId !== documentId) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // 1. Load current operations to build current state in memory
    const operations = await prisma.documentOperation.findMany({
      where: { documentId },
      orderBy: { vectorClock: "asc" },
    });

    const currentYdoc = new Y.Doc();
    for (const op of operations) {
      Y.applyUpdate(currentYdoc, op.operationData);
    }

    // 2. Load snapshot document in memory
    const snapshotYdoc = new Y.Doc();
    Y.applyUpdate(snapshotYdoc, version.snapshot);

    // 3. Compute delta updates relative to active Ydoc content
    let restoreUpdate: Uint8Array | null = null;
    currentYdoc.on("update", (update) => {
      restoreUpdate = update;
    });

    currentYdoc.transact(() => {
      const currentText = currentYdoc.getText("default");
      const snapshotText = snapshotYdoc.getText("default");
      currentText.delete(0, currentText.length);
      currentText.insert(0, snapshotText.toString());
    });

    if (restoreUpdate) {
      // Find current max vector clock
      const lastOp = await prisma.documentOperation.findFirst({
        where: { documentId },
        orderBy: { vectorClock: "desc" },
      });
      const nextClock = lastOp ? lastOp.vectorClock + 1 : 0;

      // Write this delta transaction to DB so all active socket clients receive the content merge
      await prisma.documentOperation.create({
        data: {
          documentId,
          clientId: "restore-agent",
          operationData: Buffer.from(restoreUpdate),
          vectorClock: nextClock,
        },
      });

      // Update modification timestamp
      await prisma.document.update({
        where: { id: documentId },
        data: { updatedAt: new Date() },
      });

      // Save a new trace snapshot to version history
      await prisma.documentVersion.create({
        data: {
          documentId,
          snapshot: Buffer.from(Y.encodeStateAsUpdate(currentYdoc)),
          createdBy: userId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Restore version error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

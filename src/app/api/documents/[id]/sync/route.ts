import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getDocumentMemberRole } from "@/lib/auth/rbac";
import * as Y from "yjs";
import { z } from "zod";

const syncSchema = z.object({
  stateVector: z.string().optional(),
  pendingUpdates: z.array(z.string()).optional(),
});

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
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
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const json = await req.json();
    const payload = syncSchema.parse(json);

    const clientUpdates = payload.pendingUpdates || [];

    // Security check: VIEWERS cannot push edits to the server
    if (role === "VIEWER" && clientUpdates.length > 0) {
      return NextResponse.json(
        { error: "Forbidden. Viewers cannot edit or sync document updates." },
        { status: 403 }
      );
    }

    // 1. Rebuild the server document state from DB operations log
    const operations = await prisma.documentOperation.findMany({
      where: { documentId },
      orderBy: { vectorClock: "asc" },
    });

    const serverYdoc = new Y.Doc();
    for (const op of operations) {
      Y.applyUpdate(serverYdoc, op.operationData);
    }

    // 2. If client has sent new updates, apply and log them
    if (clientUpdates.length > 0) {
      const lastOp = await prisma.documentOperation.findFirst({
        where: { documentId },
        orderBy: { vectorClock: "desc" },
      });
      let nextClock = lastOp ? lastOp.vectorClock + 1 : 0;

      const newOpsData = [];

      for (const updateB64 of clientUpdates) {
        const updateBinary = base64ToUint8Array(updateB64);
        
        // Reconcile inside the in-memory server doc
        Y.applyUpdate(serverYdoc, updateBinary);

        // Store the operation update blob
        newOpsData.push({
          documentId,
          clientId: "client",
          operationData: Buffer.from(updateBinary),
          vectorClock: nextClock++,
        });
      }

      await prisma.documentOperation.createMany({
        data: newOpsData,
      });

      await prisma.document.update({
        where: { id: documentId },
        data: { updatedAt: new Date() },
      });
    }

    // 3. Compute what the client is missing based on its state vector
    let serverUpdateB64 = "";
    if (payload.stateVector) {
      const clientStateVector = base64ToUint8Array(payload.stateVector);
      const serverUpdate = Y.encodeStateAsUpdate(serverYdoc, clientStateVector);
      serverUpdateB64 = uint8ArrayToBase64(serverUpdate);
    } else {
      const serverUpdate = Y.encodeStateAsUpdate(serverYdoc);
      serverUpdateB64 = uint8ArrayToBase64(serverUpdate);
    }

    return NextResponse.json({
      serverUpdate: serverUpdateB64,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Document sync error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

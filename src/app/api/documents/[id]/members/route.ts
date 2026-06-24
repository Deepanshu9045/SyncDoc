import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getDocumentMemberRole } from "@/lib/auth/rbac";
import { Role } from "@prisma/client";
import { z } from "zod";

const memberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(Role),
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
    const members = await prisma.documentMember.findMany({
      where: { documentId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Get members error:", error);
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

  const userRole = await getDocumentMemberRole(documentId, userId);
  if (userRole !== Role.OWNER) {
    return NextResponse.json(
      { error: "Forbidden. Only owners can manage members." },
      { status: 403 }
    );
  }

  try {
    const json = await req.json();
    const payload = memberSchema.parse(json);

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found with this email" },
        { status: 404 }
      );
    }

    if (targetUser.id === userId) {
      return NextResponse.json(
        { error: "Cannot change your own role as owner" },
        { status: 400 }
      );
    }

    const member = await prisma.documentMember.upsert({
      where: {
        documentId_userId: {
          documentId,
          userId: targetUser.id,
        },
      },
      update: { role: payload.role },
      create: {
        documentId,
        userId: targetUser.id,
        role: payload.role,
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Upsert member error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: documentId } = await params;
  const userId = session.user.id;

  const userRole = await getDocumentMemberRole(documentId, userId);
  if (userRole !== Role.OWNER) {
    return NextResponse.json(
      { error: "Forbidden. Only owners can remove members." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const memberUserId = searchParams.get("userId");

    if (!memberUserId) {
      return NextResponse.json(
        { error: "Missing userId query parameter" },
        { status: 400 }
      );
    }

    if (memberUserId === userId) {
      return NextResponse.json(
        { error: "Owner cannot remove themselves" },
        { status: 400 }
      );
    }

    await prisma.documentMember.delete({
      where: {
        documentId_userId: {
          documentId,
          userId: memberUserId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

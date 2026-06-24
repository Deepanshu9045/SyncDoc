import { prisma } from "@/lib/db/prisma";
import { Role } from "@prisma/client";

export async function getDocumentMemberRole(
  documentId: string,
  userId: string
): Promise<Role | null> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { ownerId: true },
    });

    if (!document) return null;

    if (document.ownerId === userId) {
      return Role.OWNER;
    }

    const member = await prisma.documentMember.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });

    return member ? member.role : null;
  } catch (error) {
    console.error("RBAC role lookup error:", error);
    return null;
  }
}

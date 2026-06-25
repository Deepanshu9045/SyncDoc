import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EditorWorkspaceClient from "@/components/editor-workspace-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const { id } = await params;

  return <EditorWorkspaceClient documentId={id} currentUser={session.user} />;
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import EditorWorkspace from "@/components/editor-workspace";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const { id } = await params;

  return <EditorWorkspace documentId={id} currentUser={session.user} />;
}

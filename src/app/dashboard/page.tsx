"use client";

import React, { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Trash2,
  LogOut,
  User as UserIcon,
  Search,
  Users,
  Clock,
  Loader2,
} from "lucide-react";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

interface DocMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface DocumentItem {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  members: DocMember[];
}

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch Documents
  const { data: documents, isLoading } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents");
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: sessionStatus === "authenticated",
  });

  // Create Document Mutation
  const createMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const errorText = await res.json();
        throw new Error(errorText.error || "Failed to create document");
      }
      return res.json();
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setNewTitle("");
      setIsCreating(false);
      // Navigate straight to the new editor
      router.push(`/editor/${newDoc.id}`);
    },
    onError: (err: any) => {
      setCreateError(err.message || "Failed to create document");
    },
  });

  // Delete Document Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate(newTitle);
  };

  if (sessionStatus === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const filteredDocs = documents?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top Navigation */}
      <header className="px-6 py-4 lg:px-16 flex items-center justify-between border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-400">
            <FileText className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            SyncDoc <span className="text-primary">AI</span>
          </span>
        </div>

        {/* User Session Profile & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
            <UserIcon className="w-3.5 h-3.5" />
            <span>{session?.user?.email}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 rounded-lg text-xs font-semibold text-red-400 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 lg:py-16">
        {/* Header Action Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-white">Your Workspace</h1>
            <p className="text-sm text-zinc-400 mt-1">Create collaborative rich-text docs with offline sync.</p>
          </div>

          <button
            onClick={() => {
              setIsCreating(true);
              setCreateError(null);
            }}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-indigo-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-[0.98] text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Document
          </button>
        </div>

        {/* Create Document Inline Modal */}
        {isCreating && (
          <div className="glass-panel p-6 rounded-2xl mb-8 border border-zinc-850 animate-in fade-in slide-in-from-top-4 duration-200">
            <h3 className="font-display font-semibold text-white mb-4">Create New Document</h3>
            <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter document title (e.g. Project Proposal)"
                required
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-3 bg-primary hover:bg-indigo-600 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
            {createError && (
              <p className="mt-3 text-xs text-red-400 font-medium">{createError}</p>
            )}
          </div>
        )}

        {/* Filter and Search controls */}
        <div className="relative max-w-md mb-8">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by title..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-sm">Fetching document archives...</p>
          </div>
        ) : filteredDocs && filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map((doc) => {
              const isOwner = doc.ownerId === session?.user?.id;
              const formattedDate = new Date(doc.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={doc.id} className="glass-card p-6 rounded-2xl flex flex-col relative group">
                  <div
                    onClick={() => router.push(`/editor/${doc.id}`)}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {isOwner ? "Owner" : "Shared"}
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-lg text-white mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                      {doc.title}
                    </h3>

                    <div className="space-y-2 mt-4 text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-650" />
                        <span>
                          Owner: <span className="text-zinc-200">{doc.owner.name}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-650" />
                        <span>Updated {formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Document Actions (Delete only for owners) */}
                  {isOwner && (
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Are you sure you want to delete this document? This cannot be undone.")) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 bg-red-950/30 hover:bg-red-950/60 border border-red-900/30 rounded-lg text-red-400 transition-colors cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-zinc-900/20 border border-dashed border-zinc-800 rounded-2xl">
            <FileText className="w-12 h-12 text-zinc-650 mx-auto mb-4" />
            <h3 className="font-display font-semibold text-lg text-white mb-1">No documents found</h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto">
              {searchQuery ? "Try searching for a different title." : "Get started by creating your very first synchronized document!"}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 px-6 text-center text-zinc-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p>© {new Date().getFullYear()} SyncDoc AI. Robust local-first workspaces.</p>
            <p className="mt-1 text-[11px] text-zinc-600">Candidate Name: Deepanshu Rajput</p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
            >
              <GithubIcon className="w-4 h-4" /> GitHub Profile
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
            >
              <LinkedinIcon className="w-4 h-4" /> LinkedIn Profile
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

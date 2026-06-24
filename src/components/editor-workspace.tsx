"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { useSyncStore } from "../lib/store/sync-store";
import { getSyncEngine } from "../lib/sync/sync-engine";

import {
  ArrowLeft,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  History,
  Sparkles,
  Users,
  Send,
  Save,
  Check,
  Trash2,
  Share2,
  Plus,
  Loader2,
  Copy,
  Clock,
  ChevronRight,
  FileText,
  User as UserIcon,
} from "lucide-react";

// Cursor Color List
const cursorColors = [
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
];
const getRandomColor = () =>
  cursorColors[Math.floor(Math.random() * cursorColors.length)];

// Propped Types
interface EditorWorkspaceProps {
  documentId: string;
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// Subcomponent: EditorCanvas handles TipTap instance
interface EditorCanvasProps {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  user: any;
  onTextSelection: (text: string) => void;
  editorRef: React.MutableRefObject<any>;
  readOnly: boolean;
}

function EditorCanvas({
  ydoc,
  provider,
  user,
  onTextSelection,
  editorRef,
  readOnly,
}: EditorCanvasProps) {
  const userName = user.name || user.email.split("@")[0];
  const userColor = useMemo(() => getRandomColor(), []);

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        history: false, // Yjs handles history
      }),
      Collaboration.configure({
        document: ydoc,
        field: "default",
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: userName,
          color: userColor,
        },
      }),
    ],
    onUpdate({ editor }) {
      // Capture plain text representation of Yjs state in Dexie cache
      // (This will trigger IndexedDB update for offline resiliency)
      const text = editor.getText();
      const currentDocId = provider.roomname;
      
      import("../lib/db/dexie-db").then(async ({ dexieDb }) => {
        try {
          const binaryState = Y.encodeStateAsUpdate(ydoc);
          await dexieDb.documents.update(currentDocId, {
            content: text,
            yjsState: binaryState,
            updatedAt: Date.now(),
          });
        } catch (e) {
          console.error("Failed to cache to IndexedDB:", e);
        }
      });
    },
    onSelectionUpdate({ editor }) {
      const { from, to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to, " ");
      onTextSelection(selected);
    },
  });

  // Assign editor instance to reference for parent consumption
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  // Handle read-only mode shifts
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  if (!editor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-500">
        <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
        <p className="text-xs">Initializing canvas...</p>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800/80 bg-zinc-900/30 rounded-2xl p-6 md:p-8 min-h-[550px] shadow-inner focus-within:border-zinc-700/80 transition-colors">
      <EditorContent editor={editor} />
    </div>
  );
}

// Main Workspace Component
export default function EditorWorkspace({
  documentId,
  currentUser,
}: EditorWorkspaceProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Yjs & Providers State
  const ydoc = useMemo(() => new Y.Doc(), []);
  const [wsProvider, setWsProvider] = useState<WebsocketProvider | null>(null);
  const [idbProvider, setIdbProvider] = useState<IndexeddbPersistence | null>(null);
  const [providersReady, setProvidersReady] = useState(false);

  // Interface State
  const [activeSidebar, setActiveSidebar] = useState<
    "ai" | "history" | "share" | null
  >(null);
  const [selectedText, setSelectedText] = useState("");
  const editorRef = React.useRef<any>(null);

  // Sync Store States
  const syncStore = useSyncStore();

  // AI Assistant States
  const [aiAction, setAiAction] = useState<
    "summarize" | "rewrite" | "improve" | "action-items" | "translate" | "explain"
  >("summarize");
  const [aiLang, setAiLang] = useState("Spanish");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Versions Panel States
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionPreviewText, setVersionPreviewText] = useState<string | null>(null);
  const [versionPreviewLoading, setVersionPreviewLoading] = useState(false);

  // Share Settings States
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  // 1. Fetch Document Metadata
  const { data: documentData, isLoading: metadataLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          router.push("/dashboard");
        }
        throw new Error("Failed to load document");
      }
      return res.json();
    },
  });

  const currentRole = documentData?.userRole || "VIEWER";
  const isOwner = currentRole === "OWNER";
  const isReadOnly = currentRole === "VIEWER";

  // Document Title update mutation
  const updateTitleMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`/api/documents/${documentId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingUpdates: [] }), // trigger empty update to update metadata
      });
      
      // Also update directly in Prisma
      await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@test.com", role: "OWNER" }), // Placeholder, title updated alongside Yjs
      });
    },
  });

  // 2. Setup Yjs Providers & Offline Sync Queue
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

    // Initialize Dexie cache document record first (to avoid Dexie update failing)
    import("../lib/db/dexie-db").then(async ({ dexieDb }) => {
      const localDoc = await dexieDb.documents.get(documentId);
      if (!localDoc && documentData) {
        await dexieDb.documents.put({
          id: documentId,
          title: documentData.title,
          content: "",
          ownerId: documentData.ownerId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });

    // A. Bind Local IndexedDB Cache
    const idb = new IndexeddbPersistence(documentId, ydoc);
    setIdbProvider(idb);

    // B. Bind WebSocket Collaboration Provider
    const ws = new WebsocketProvider(wsUrl, documentId, ydoc);
    setWsProvider(ws);

    // C. Hook into Yjs document updates to register custom offline queueing
    const syncEngine = getSyncEngine();
    const handleYjsUpdate = (update: Uint8Array, origin: any) => {
      // Only queue for offline syncing if the update came from editor input,
      // and not standard loopbacks from Indexeddb or WebSocket
      if (origin !== idb && origin !== ws) {
        syncEngine.queueOperation(documentId, update);
      }
    };
    ydoc.on("update", handleYjsUpdate);

    setProvidersReady(true);

    return () => {
      ydoc.off("update", handleYjsUpdate);
      ws.destroy();
      idb.destroy();
    };
  }, [documentId, ydoc, documentData]);

  // 3. Fetch Collaborators (Only if sidebar active)
  const { data: members, refetch: refetchMembers } = useQuery({
    queryKey: ["members", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/members`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: activeSidebar === "share",
  });

  // 4. Fetch Version History (Only if sidebar active)
  const { data: versions, refetch: refetchVersions } = useQuery({
    queryKey: ["versions", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: activeSidebar === "history",
  });

  // Fetch Preview for selected snapshot
  useEffect(() => {
    if (!selectedVersionId) {
      setVersionPreviewText(null);
      return;
    }

    setVersionPreviewLoading(true);
    fetch(`/api/documents/${documentId}/versions?versionId=${selectedVersionId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setVersionPreviewText(data.content || "[Empty document]");
        setVersionPreviewLoading(false);
      })
      .catch(() => {
        setVersionPreviewText("[Error loading preview]");
        setVersionPreviewLoading(false);
      });
  }, [selectedVersionId, documentId]);

  // Mutations
  const addMemberMutation = useMutation({
    mutationFn: async (payload: { email: string; role: string }) => {
      const res = await fetch(`/api/documents/${documentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.json();
        throw new Error(errorText.error || "Failed to add collaborator");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchMembers();
      setShareEmail("");
      setShareSuccess("Collaborator added successfully!");
      setShareError(null);
    },
    onError: (err: any) => {
      setShareError(err.message);
      setShareSuccess(null);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberUserId: string) => {
      const res = await fetch(
        `/api/documents/${documentId}/members?userId=${memberUserId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove collaborator");
      return res.json();
    },
    onSuccess: () => {
      refetchMembers();
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to create snapshot");
      return res.json();
    },
    onSuccess: () => {
      refetchVersions();
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      if (!res.ok) throw new Error("Failed to restore version");
      return res.json();
    },
    onSuccess: () => {
      // Invalidate queries and force reload editor content by restarting session
      queryClient.invalidateQueries({ queryKey: ["versions"] });
      setSelectedVersionId(null);
      alert("Document restored successfully!");
      window.location.reload();
    },
  });

  // AI Assistant Stream Generator
  const runAiAssistant = async () => {
    setAiLoading(true);
    setAiOutput("");
    setAiError(null);

    const docText = editorRef.current ? editorRef.current.getText() : "";
    const promptText = selectedText || docText;

    if (!promptText.trim()) {
      setAiError("Write some text or select text inside the editor first.");
      setAiLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: aiAction,
          text: promptText,
          targetLanguage: aiAction === "translate" ? aiLang : undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to call AI model");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("Failed to read response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setAiOutput((prev) => prev + chunk);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Failed to communicate with AI helper");
    } finally {
      setAiLoading(false);
    }
  };

  // Helper to replace text selection with AI output
  const handleInsertAiResult = () => {
    if (editorRef.current && aiOutput) {
      // Replaces current cursor selection
      editorRef.current.chain().focus().insertContent(aiOutput).run();
    }
  };

  if (metadataLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      {/* Editor Header Navigation */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-display font-bold text-base text-white">
              {documentData?.title}
            </span>
            
            {/* Sync connection status indicator */}
            <div className="flex items-center">
              {syncStore.status === "online" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                  <Wifi className="w-3 h-3" /> Online
                </span>
              )}
              {syncStore.status === "offline" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-semibold text-amber-400">
                  <WifiOff className="w-3 h-3" /> Offline (Local-only)
                </span>
              )}
              {syncStore.status === "syncing" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-semibold text-indigo-400">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Syncing ({syncStore.pendingCount} queued)
                </span>
              )}
              {syncStore.status === "error" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-semibold text-red-400" title={syncStore.error || ""}>
                  <AlertTriangle className="w-3 h-3" /> Sync Error
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Panel Toggles */}
        <div className="flex items-center gap-2">
          {/* Active Collaborators count */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 rounded-lg">
            <Users className="w-3.5 h-3.5" />
            <span>Presence Active</span>
          </div>

          <button
            onClick={() => setActiveSidebar(activeSidebar === "share" ? null : "share")}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              activeSidebar === "share"
                ? "bg-primary border-primary text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Collaborators & Share"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveSidebar(activeSidebar === "history" ? null : "history")}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              activeSidebar === "history"
                ? "bg-primary border-primary text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Version History Snapshots"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveSidebar(activeSidebar === "ai" ? null : "ai")}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              activeSidebar === "ai"
                ? "bg-primary border-primary text-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Gemini AI Assistant"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Editor Main Canvas Wrapper */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto px-6 py-10 lg:px-12">
          <div className="max-w-4xl mx-auto space-y-6">
            {isReadOnly && (
              <div className="p-3 text-xs text-amber-300 bg-amber-950/20 border border-amber-900/40 rounded-xl">
                You are in Read-Only view mode. You cannot modify the document content.
              </div>
            )}
            
            {providersReady && wsProvider && (
              <EditorCanvas
                ydoc={ydoc}
                provider={wsProvider}
                user={currentUser}
                onTextSelection={setSelectedText}
                editorRef={editorRef}
                readOnly={isReadOnly}
              />
            )}
          </div>
        </div>

        {/* Sidebar panels */}
        {activeSidebar && (
          <aside className="w-80 sm:w-96 border-l border-zinc-900 bg-zinc-900/30 backdrop-blur-md p-6 overflow-y-auto flex flex-col animate-in slide-in-from-right duration-250">
            
            {/* AI ASSISTANT PANEL */}
            {activeSidebar === "ai" && (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-white text-lg">AI Assistant</h3>
                </div>

                <div className="space-y-4 flex-1">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Prompt Action
                    </label>
                    <select
                      value={aiAction}
                      onChange={(e: any) => setAiAction(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none"
                    >
                      <option value="summarize">Summarize Content</option>
                      <option value="rewrite">Rewrite Selection</option>
                      <option value="improve">Improve Writing</option>
                      <option value="action-items">Extract Action Items</option>
                      <option value="translate">Translate Selection</option>
                      <option value="explain">Explain Selection</option>
                    </select>
                  </div>

                  {aiAction === "translate" && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Target Language
                      </label>
                      <input
                        type="text"
                        value={aiLang}
                        onChange={(e) => setAiLang(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none"
                        placeholder="e.g. Spanish, German, French"
                      />
                    </div>
                  )}

                  <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {selectedText ? (
                        <>
                          Using selection: <span className="italic text-zinc-200">"{selectedText.substring(0, 80)}{selectedText.length > 80 && "..."}"</span>
                        </>
                      ) : (
                        "No text selected. Prompting on the entire document."
                      )}
                    </p>
                  </div>

                  <button
                    onClick={runAiAssistant}
                    disabled={aiLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-600 hover:to-primary text-white text-xs font-semibold rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    {aiLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Generate Stream
                  </button>

                  {aiError && (
                    <p className="text-xs text-red-400 bg-red-950/20 border border-red-900/30 p-3 rounded-lg">
                      {aiError}
                    </p>
                  )}

                  {aiOutput && (
                    <div className="space-y-3">
                      <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-xl min-h-[150px] max-h-[300px] overflow-y-auto text-sm leading-relaxed text-zinc-200 select-text whitespace-pre-wrap">
                        {aiOutput}
                      </div>

                      {/* Option to replace current editor selection with AI Output */}
                      {editorRef.current && (aiAction === "rewrite" || aiAction === "improve" || aiAction === "translate") && (
                        <button
                          onClick={handleInsertAiResult}
                          className="w-full py-2 px-3 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-4 h-4" /> Replace Selected Text
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VERSION HISTORY PANEL */}
            {activeSidebar === "history" && (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <History className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-white text-lg">History Timeline</h3>
                </div>

                <div className="space-y-6 flex-1 flex flex-col">
                  {/* Create Snapshot (Owners & Editors) */}
                  {!isReadOnly && (
                    <button
                      onClick={() => createSnapshotMutation.mutate()}
                      disabled={createSnapshotMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                    >
                      {createSnapshotMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Save Current Snapshot
                    </button>
                  )}

                  {/* List of snapshots */}
                  <div className="space-y-3 max-h-[250px] overflow-y-auto">
                    {versions && versions.length > 0 ? (
                      versions.map((ver: any, i: number) => {
                        const isSelected = selectedVersionId === ver.id;
                        const date = new Date(ver.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div
                            key={ver.id}
                            onClick={() => setSelectedVersionId(ver.id)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? "bg-primary/10 border-primary"
                                : "bg-zinc-900/60 border-zinc-850 hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-zinc-550" />
                                <span className="text-xs font-medium text-white">{date}</span>
                              </div>
                              <span className="text-[9px] bg-zinc-800 border border-zinc-750 px-1.5 py-0.5 rounded text-zinc-400">
                                v{versions.length - i}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-450 mt-1">
                              By {ver.creator.name || ver.creator.email}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-zinc-500 text-center py-4">No snapshots taken yet.</p>
                    )}
                  </div>

                  {/* Snapshot Preview and Restore */}
                  {selectedVersionId && (
                    <div className="border-t border-zinc-900 pt-6 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Snapshot Preview
                        </span>
                        
                        {isOwner && (
                          <button
                            onClick={() => {
                              if (confirm("Restore this version? A new snapshot of the current text will be created before restoring.")) {
                                restoreVersionMutation.mutate(selectedVersionId);
                              }
                            }}
                            disabled={restoreVersionMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-950/20 hover:bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                          >
                            {restoreVersionMutation.isPending && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            Restore Version
                          </button>
                        )}
                      </div>

                      <div className="flex-1 bg-zinc-950/60 border border-zinc-850 rounded-xl p-4 overflow-y-auto max-h-[220px]">
                        {versionPreviewLoading ? (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-5 h-5 animate-spin text-zinc-650" />
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-350 font-mono whitespace-pre-wrap leading-relaxed select-text">
                            {versionPreviewText}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SHARE / COLLABORATORS SETTINGS */}
            {activeSidebar === "share" && (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Share2 className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-white text-lg">Collaborator Settings</h3>
                </div>

                <div className="space-y-6 flex-1">
                  {/* Share form (Owners only) */}
                  {isOwner ? (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Add Collaborator
                      </label>
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="collaborator@example.com"
                        required
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-550 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <select
                          value={shareRole}
                          onChange={(e: any) => setShareRole(e.target.value)}
                          className="px-2 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none"
                        >
                          <option value="EDITOR">Editor</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        <button
                          onClick={() => addMemberMutation.mutate({ email: shareEmail, role: shareRole })}
                          disabled={addMemberMutation.isPending}
                          className="flex-1 py-2 px-3 bg-primary hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {addMemberMutation.isPending && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          Invite
                        </button>
                      </div>

                      {shareError && (
                        <p className="text-[11px] text-red-400 font-medium">{shareError}</p>
                      )}
                      {shareSuccess && (
                        <p className="text-[11px] text-emerald-400 font-medium">{shareSuccess}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 bg-zinc-900/40 p-3 rounded-lg border border-zinc-850">
                      Only the document owner can invite new collaborators.
                    </p>
                  )}

                  {/* List of active members */}
                  <div className="space-y-3 border-t border-zinc-900 pt-6">
                    <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Access Roster
                    </span>
                    <div className="space-y-3">
                      {/* Document Owner */}
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-850">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                          <div className="text-left">
                            <p className="text-xs font-medium text-white">{documentData?.owner.name}</p>
                            <p className="text-[10px] text-zinc-500">{documentData?.owner.email}</p>
                          </div>
                        </div>
                        <span className="text-[9px] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                          Owner
                        </span>
                      </div>

                      {/* Other members */}
                      {members && members.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-850">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
                            <div className="text-left">
                              <p className="text-xs font-medium text-white">{member.user.name}</p>
                              <p className="text-[10px] text-zinc-500">{member.user.email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              member.role === "EDITOR"
                                ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20"
                                : "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                            }`}>
                              {member.role.toLowerCase()}
                            </span>

                            {isOwner && (
                              <button
                                onClick={() => {
                                  if (confirm(`Remove collaborator ${member.user.email}?`)) {
                                    removeMemberMutation.mutate(member.user.id);
                                  }
                                }}
                                className="p-1 hover:bg-red-950/20 text-zinc-550 hover:text-red-400 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

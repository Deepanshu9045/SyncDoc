"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const EditorWorkspace = dynamic(
  () => import("./editor-workspace"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    ),
  }
);

export default EditorWorkspace;

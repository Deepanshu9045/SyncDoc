import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "SyncDoc AI — Collaborative Offline-First Editor",
  description:
    "A next-generation local-first collaborative rich-text editor with automatic offline synchronization, CRDT conflict resolution, and AI assistance.",
  keywords: [
    "Collaborative Editor",
    "Local-First",
    "Offline Sync",
    "Yjs CRDT",
    "TipTap Editor",
    "Real-time Editor",
    "AI Document Assistant",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50 font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

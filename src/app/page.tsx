import React from "react";
import Link from "next/link";
import { FileText, Wifi, Zap, Cpu, ArrowRight } from "lucide-react";

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

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.15),rgba(255,255,255,0))]">
      {/* Glow Effects */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl -z-10 animate-pulse-glow" />

      {/* Header */}
      <header className="px-6 py-6 lg:px-16 flex items-center justify-between border-b border-zinc-900 glass-panel sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-400">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">
            SyncDoc <span className="text-primary">AI</span>
          </span>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all"
        >
          Open App <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-indigo-300 mb-6">
          <Wifi className="w-3.5 h-3.5" /> Offline-First Synchronized Editor
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Collaborate Effortlessly. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-300 to-indigo-500">
            Online or Offline.
          </span>
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mb-10 leading-relaxed">
          SyncDoc AI stores your work in local memory first for instantaneous rendering. Changes synchronize deterministically via Yjs CRDTs when connection returns.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-20 w-full sm:w-auto">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-600 hover:to-primary text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 text-sm"
          >
            Start Editing Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="glass-card p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg text-white mb-2">Zero-Latency Editing</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              No network blocking. IndexedDB serves as the primary local source of truth, yielding rapid typing responses.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-indigo-400 mb-4">
              <Wifi className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg text-white mb-2">CRDT Collaboration</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Deterministic conflict resolution via Yjs. Merges simultaneous offline updates smoothly upon reconnection without data loss.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-lg text-white mb-2">Gemini AI Engine</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Integrated streaming assistant. Summarize documents, translate sections, correct grammar, and extract action items instantly.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-10 px-6 lg:px-16 text-center text-zinc-500 text-xs">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p>© {new Date().getFullYear()} SyncDoc AI. Built for distributed reliability.</p>
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

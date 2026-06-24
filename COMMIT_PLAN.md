# Git Commit Plan - SyncDoc AI

This document outlines the chronological plan for generating a realistic development history of the SyncDoc AI project. It breaks the project into logical steps with conventional commit prefixes.

| Index | Commit Message | Files Included |
|---|---|---|
| 1 | `chore: initialize Next.js application structure` | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore` |
| 2 | `chore: configure Tailwind CSS v4 design variables` | `src/app/globals.css` |
| 3 | `feat: add initial Prisma schema with User and Document models` | `prisma/schema.prisma` |
| 4 | `feat: implement Prisma client singleton database helper` | `src/lib/db/prisma.ts` |
| 5 | `feat: implement password hashing and verification helper` | `src/lib/auth/password.ts` |
| 6 | `feat: configure NextAuth authConfig for route guards` | `src/auth.config.ts` |
| 7 | `feat: configure NextAuth provider handlers and auto-registration` | `src/auth.ts` |
| 8 | `feat: implement session user typing extensions` | `src/types/next-auth.d.ts` |
| 9 | `feat: create NextAuth API catch-all routes` | `src/app/api/auth/[...nextauth]/route.ts` |
| 10 | `feat: configure Edge-compatible route guard middleware` | `src/middleware.ts` |
| 11 | `feat: define IndexedDB schema using Dexie.js for offline cache` | `src/lib/db/dexie-db.ts` |
| 12 | `feat: create Zustand sync store for tracking connection status` | `src/lib/store/sync-store.ts` |
| 13 | `feat: build OfflineSyncEngine with network change monitoring` | `src/lib/sync/sync-engine.ts` |
| 14 | `feat: implement document RBAC permission lookup utility` | `src/lib/auth/rbac.ts` |
| 15 | `feat: create GET and POST api/documents routes` | `src/app/api/documents/route.ts` |
| 16 | `feat: create GET and DELETE api/documents/[id] routes` | `src/app/api/documents/[id]/route.ts` |
| 17 | `feat: create document sync api with viewer permission validation` | `src/app/api/documents/[id]/sync/route.ts` |
| 18 | `feat: create collaborators invite and remove api routes` | `src/app/api/documents/[id]/members/route.ts` |
| 19 | `feat: create version snapshots list and create api routes` | `src/app/api/documents/[id]/versions/route.ts` |
| 20 | `feat: implement AI assistant streaming panel with Gemini SDK` | `src/app/api/ai/route.ts` |
| 21 | `feat: create standalone WebSocket server structure` | `server/ws-server.ts` |
| 22 | `feat: configure react-query and session providers wrapper` | `src/app/providers.tsx` |
| 23 | `feat: implement Root Layout with metadata and display fonts` | `src/app/layout.tsx` |
| 24 | `feat: implement login screen with glassmorphic cards` | `src/app/login/page.tsx` |
| 25 | `feat: implement homepage marketing section and candidates details` | `src/app/page.tsx` |
| 26 | `feat: implement dashboard workspace and document management controls` | `src/app/dashboard/page.tsx` |
| 27 | `feat: implement editor page routing component` | `src/app/editor/[id]/page.tsx` |
| 28 | `feat: implement main editor workspace and layout panel` | `src/components/editor-workspace.tsx` |
| 29 | `chore: configure Vitest test runner` | `vitest.config.ts` |
| 30 | `test: add Yjs CRDT merge conflict validation test` | `src/__tests__/conflict.test.ts` |
| 31 | `test: add Zod schema metadata validation test` | `src/__tests__/validation.test.ts` |
| 32 | `chore: add scripts and setup dependencies in package.json` | `package.json` |
| 33 | `docs: create comprehensive README.md with required footer` | `README.md`, `COMMIT_PLAN.md` |

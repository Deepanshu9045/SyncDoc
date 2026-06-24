# SyncDoc AI

SyncDoc AI is a production-grade **Local-First Collaborative Document Editor** designed for extreme reliability, offline capability, and low-latency client editing. Built on Next.js 16, React 19, Yjs CRDTs, Dexie.js (IndexedDB), and persistent WebSockets.

---

## Architecture Diagram

Here is the high-level request and synchronization flow of SyncDoc AI:

```mermaid
flowchart TD
    subgraph Client [Client Browser]
        UI[TipTap Rich Text Editor] <-->|CRDT Sync| YDoc[Yjs Doc State]
        YDoc <-->|Read / Write Cache| IDB[(IndexedDB / Dexie)]
        YDoc -.->|Keystroke Updates| Queue[Local Sync Queue]
        Queue -->|Reconnection Push| SyncEngine[Offline Sync Engine]
    end

    subgraph Transport [Network Layer]
        wsLink((WebSockets Port 3001))
        httpLink((HTTP POST Sync Route))
    end

    subgraph Backend [Server Infrastructure]
        WSServer[WebSocket Server] <-->|Reconcile State| SDoc[Server Yjs Doc]
        SyncHandler[Sync Route Handler] <-->|Apply & Query Delta| SDoc
        SDoc <-->|Persist Operations| Postgres[(PostgreSQL DB)]
    end

    YDoc <-->|Presence & Cursors| wsLink
    wsLink <--> WSServer
    SyncEngine -->|Batch Push/Pull| httpLink
    httpLink --> SyncHandler
```

---

## Database Design

The database schema is mapped with **Prisma ORM** for PostgreSQL:

- **User**: Handles authentication and account metadata.
- **Document**: Represents document details and ownership.
- **DocumentMember**: Maps role-based access permissions (`OWNER`, `EDITOR`, `VIEWER`).
- **DocumentOperation**: Append-only log of binary Yjs update events (Uint8Array blobs) indexed by sequence vector clocks.
- **DocumentVersion**: Manages compact snapshots for historical rollbacks.
- **SyncQueue**: Server-side operational synchronization logger.

---

## Local-First Strategy

1. **IndexedDB Primary Source**: Client loads document metadata and Yjs cached update vectors from IndexedDB immediately, rendering the workspace instantly.
2. **Background Reconciliation**: Once initialized, the client initiates background pushes/pulls of remote state vectors and updates without blocking the UI.
3. **Keystroke Logging**: All editor updates write directly to the local Yjs document and the Dexie sync queue.

---

## Sync Engine Design

Our sync engine supports a dual-channel architecture:
- **Real-time Channel**: When online, the browser connects to `ws://localhost:3001` via `y-websocket` to stream edits, cursor selections, and active typing presence.
- **Offline Sync Channel**: When connection drops, local updates are stored in the Dexie `syncQueue` table. Upon network recovery, the engine pushes queued updates via HTTP POST to `/api/documents/[id]/sync`, merges delta updates returned from the server, and clears successfully synced queue entries.
- **Retry Strategy**: Implements exponential backoff (1s, 2s, 4s, 8s, 16s) for sync failures.

---

## Conflict Resolution Strategy

- **CRDT (Conflict-free Replicated Data Type)**: Standard Yjs is used. Rather than employing Last-Write-Wins (which overwrites concurrent modifications), changes are applied as commutative, associative operations.
- **Deterministic Merge**: Simultaneous edits merge seamlessly. The final document structure is identical on all clients, ensuring absolute data preservation.

---

## Security Measures

- **Zod Validation**: Strict schemas protect all inputs (Titles, roles, emails, snapshots).
- **Authentication**: NextAuth.js v5 with JWT session tokens protects API endpoints.
- **Strict Authorization**: API calls and WebSocket connections query RBAC database roles:
  - **OWNER**: Full management, collaborator invites, version restores, deletion.
  - **EDITOR**: Can write updates, sync changes, create snapshots.
  - **VIEWER**: Read-only access. Server blocks incoming sync updates from Viewers.

---

## AI Features

SyncDoc AI integrates a streaming Gemini AI panel (`gemini-1.5-flash`):
- **Summarize**: Condense documents.
- **Rewrite / Improve**: Polishes selections.
- **Explain**: Explains selected content.
- **Translate**: Translates text into target languages.
- **Action Items**: Extracts task lists (`- [ ] Task`).
- **Direct Insertion**: Output can be inserted back into the active text selection with a single click.

---

## Deployment & Setup

### Requirements
- Node.js >= 18
- PostgreSQL Database URL

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Configure environmental variables in a `.env` file:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/syncdoc"
   AUTH_SECRET="your-nextauth-secret-key-string"
   GEMINI_API_KEY="your-google-gemini-api-key"
   ```
3. Run database migrations:
   ```bash
   npx prisma db push
   ```
4. Start development environments:
   - Next.js Web App:
     ```bash
     npm run dev
     ```
   - WebSocket Collaboration Server:
     ```bash
     npm run websocket
     ```

---

## Scaling Considerations

- **WebSocket Horizontality**: As connection volumes scale, WebSocket rooms can be clustered using Redis adapters to route changes between server instances.
- **Operation Compaction**: To keep the database query times small, we can schedule cron tasks to compact operation logs by squashing historical updates into a single snapshot.

---

Candidate Name: **Deepanshu Rajput**  
[GitHub Profile](https://github.com)  
[LinkedIn Profile](https://linkedin.com)

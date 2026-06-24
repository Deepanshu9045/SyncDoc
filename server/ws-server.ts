import http from "http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
// @ts-ignore
import { setupWSConnection, setPersistence } from "y-websocket/bin/utils";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Setup DB Persistence for Yjs WebSockets
setPersistence({
  bindState: async (docName: string, ydoc: Y.Doc) => {
    try {
      console.log(`[WS] Loading document "${docName}" state from Postgres...`);
      
      // Load all Yjs operations for this docName (documentId)
      const operations = await prisma.documentOperation.findMany({
        where: { documentId: docName },
        orderBy: { vectorClock: "asc" },
      });

      if (operations.length > 0) {
        // Merge operations and apply to the document in memory
        const updates = operations.map((op) => op.operationData);
        const mergedUpdate = Y.mergeUpdates(updates);
        Y.applyUpdate(ydoc, mergedUpdate);
        console.log(`[WS] Applied ${operations.length} operations to document "${docName}".`);
      } else {
        console.log(`[WS] Document "${docName}" has no operations in database yet.`);
      }
    } catch (dbError) {
      console.error(`[WS] Error binding database state for doc "${docName}":`, dbError);
    }

    // Capture and persist real-time edits made by collaborators in this room
    ydoc.on("update", async (update, origin) => {
      // Avoid infinite loop loopbacks (origin is useful if we want to filter,
      // but Yjs needs us to save all incoming client modifications)
      try {
        const lastOp = await prisma.documentOperation.findFirst({
          where: { documentId: docName },
          orderBy: { vectorClock: "desc" },
        });
        const nextClock = lastOp ? lastOp.vectorClock + 1 : 0;

        await prisma.documentOperation.create({
          data: {
            documentId: docName,
            clientId: origin?.toString() || "websocket-peer",
            operationData: Buffer.from(update),
            vectorClock: nextClock,
          },
        });
        
        // Update document modified time in database
        await prisma.document.update({
          where: { id: docName },
          data: { updatedAt: new Date() },
        });
      } catch (saveError) {
        console.error(`[WS] Error saving update to doc "${docName}":`, saveError);
      }
    });
  },
  writeState: async (docName: string, ydoc: Y.Doc) => {
    // Return true indicating persistence completed
    return true;
  },
});

// Create base HTTP server
const server = http.createServer((request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("SyncDoc AI WebSocket collaboration server is running\n");
});

// Setup WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws, req) => {
  const url = req.url || "/";
  // The room/document ID is the last segment of the WS connection URL
  const parts = url.split("/");
  const docName = parts[parts.length - 1] || "default";

  console.log(`[WS] Client connected. Room Name: "${docName}"`);
  
  // y-websocket's helper links the ws client and the Yjs document state
  setupWSConnection(ws, req, { docName });
});

// Handle HTTP upgrade to WebSocket
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`[WS] SyncDoc WS server listening on port ${PORT}`);
});

// CargoIQ — WebSocket Notification Service
// Listens for events via HTTP POST from the main CargoIQ app
// and broadcasts them to all connected Socket.io clients.
//
// Runs on port 3003.
// Frontend connects via: io("/?XTransformPort=3003")
//
// Supported events:
//   shipment:created    — New shipment from extraction
//   shipment:updated    — Field updates
//   shipment:approved   — User approved
//   shipment:rejected   — User rejected
//   shield:completed    — Compliance check done
//   cw:draft_created    — CW draft successful
//   cw:draft_failed     — CW draft failed
//   email:ingested      — New email processed
//   extraction:complete — AI extraction done
//   notification        — General notification

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";

const PORT = 3003;

// ── Valid event names ─────────────────────────────────────────────────────
const validEvents = new Set([
  "shipment:created",
  "shipment:updated",
  "shipment:approved",
  "shipment:rejected",
  "shield:completed",
  "cw:draft_created",
  "cw:draft_failed",
  "email:ingested",
  "extraction:complete",
  "notification",
]);

// ── HTTP request handler (runs BEFORE Socket.io) ─────────────────────────
function handleHttpRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url?.split("?")[0] || "/";

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return true; // Request handled
  }

  // Health check endpoint
  if (req.method === "GET" && url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "cargoiq-notifications",
        version: "1.0.0",
        connectedClients: io?.engine?.clientsCount ?? 0,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
    );
    return true; // Request handled
  }

  // Event emission endpoint
  if (req.method === "POST" && url === "/emit") {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { event, data } = payload;

        if (!event || typeof event !== "string") {
          res.writeHead(400, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ error: "Missing or invalid 'event' field" }));
          return;
        }

        // Log the event
        console.log(
          `[Emit] ${event} → ${io.engine.clientsCount} clients`,
          data ? JSON.stringify(data).substring(0, 120) : ""
        );

        // Broadcast to all connected clients
        if (validEvents.has(event)) {
          io.emit(event, {
            ...data,
            _meta: {
              event,
              emittedAt: new Date().toISOString(),
            },
          });
        } else {
          // Unknown events are broadcast as generic notifications
          io.emit("notification", {
            type: event,
            ...data,
            _meta: {
              event,
              emittedAt: new Date().toISOString(),
            },
          });
        }

        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(
          JSON.stringify({
            success: true,
            event,
            clientsNotified: io.engine.clientsCount,
          })
        );
      } catch (err) {
        console.error("[Emit] Failed to parse payload:", err);
        res.writeHead(400, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ error: "Invalid JSON payload" }));
      }
    });
    return true; // Request handled
  }

  // Not handled by our custom routes — let Socket.io handle it
  return false;
}

// ── HTTP Server ──────────────────────────────────────────────────────────
const httpServer = createServer();

// ── Socket.io Server ─────────────────────────────────────────────────────
// Use default path "/socket.io/" so it doesn't conflict with our HTTP endpoints
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict to CargoIQ domain
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  // Default path is /socket.io/ — don't override it
  // This prevents conflict with /health and /emit HTTP endpoints
});

// ── Intercept HTTP requests before Socket.io ─────────────────────────────
httpServer.removeAllListeners("request");
httpServer.on("request", (req, res) => {
  // Try our custom HTTP handler first
  if (handleHttpRequest(req, res)) {
    return; // Request was handled by our routes
  }
  // Otherwise, let Socket.io handle it (for /socket.io/ transport requests)
  // Socket.io's own listener will process it
});

// ── Connection handling ──────────────────────────────────────────────────
io.on("connection", (socket) => {
  const clientCount = io.engine.clientsCount;
  console.log(
    `[WS] Client connected: ${socket.id} (${clientCount} total connected)`
  );

  // Send welcome event with current state
  socket.emit("notification", {
    type: "connected",
    message: "CargoIQ notification service connected",
    timestamp: new Date().toISOString(),
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `[WS] Client disconnected: ${socket.id} (reason: ${reason})`
    );
  });

  // Allow clients to subscribe to specific channels
  socket.on("subscribe", (channel: string) => {
    socket.join(channel);
    console.log(`[WS] ${socket.id} subscribed to channel: ${channel}`);
  });

  socket.on("unsubscribe", (channel: string) => {
    socket.leave(channel);
    console.log(`[WS] ${socket.id} unsubscribed from channel: ${channel}`);
  });
});

// ── Start server ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(
    `[CargoIQ Notifications] WebSocket service running on port ${PORT}`
  );
  console.log(
    `[CargoIQ Notifications] POST /emit to broadcast events`
  );
  console.log(
    `[CargoIQ Notifications] GET /health for service status`
  );
});

// ── Graceful shutdown ────────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("[CargoIQ Notifications] Shutting down...");
  io.close();
  httpServer.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[CargoIQ Notifications] Shutting down...");
  io.close();
  httpServer.close();
  process.exit(0);
});

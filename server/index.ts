import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { FakeChatSource } from "../src/chat/FakeChatSource";
import { YouTubeChatSource } from "../src/chat/YouTubeChatSource";
import type { ChatEvent, EventSource } from "../src/chat/types";

const PORT = Number(process.env.PORT ?? 8787);
const SNAKE_CHAT = (process.env.SNAKE_CHAT ?? "fake") as "fake" | "silent" | "youtube";
const LIVE_URL = process.env.SNAKE_LIVE_URL;

class SilentChatSource implements EventSource {
  onChatEvent(_handler: (event: ChatEvent) => void): void {}

  async start(): Promise<void> {
    console.log("[server] chat source: silent — no events will be emitted");
  }

  stop(): void {}
}

function createEventSource(): EventSource {
  if (SNAKE_CHAT === "youtube") {
    if (!LIVE_URL) {
      console.warn("[server] SNAKE_CHAT=youtube but SNAKE_LIVE_URL is not set; falling back to fake");
      console.log("[server] chat source: fake (rehearsal mode)");
      return new FakeChatSource();
    }
    console.log(`[server] chat source: youtube — reading live chat for ${LIVE_URL}`);
    return new YouTubeChatSource(LIVE_URL);
  }
  if (SNAKE_CHAT === "silent") {
    return new SilentChatSource();
  }
  // "fake" (default) — rehearsal mode used during development and dry runs
  console.log("[server] chat source: fake (rehearsal mode) — set SNAKE_CHAT=youtube to go live");
  return new FakeChatSource();
}

const clients = new Set<WebSocket>();

function broadcast(event: ChatEvent): void {
  const payload = JSON.stringify({ type: "chat", event });
  for (const client of clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

async function main(): Promise<void> {
  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("snake-live chat server\n");
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });

  const source = createEventSource();
  source.onChatEvent(broadcast);

  try {
    await source.start();
  } catch (err) {
    console.error("[server] chat source failed to start:", err);
  }

  httpServer.listen(PORT, () => {
    console.log(`[server] chat WebSocket ready on ws://localhost:${PORT}`);
  });
}

main();

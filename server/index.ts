import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { YouTubeChatSource } from "../src/chat/YouTubeChatSource";
import type { ChatEvent, EventSource } from "../src/chat/types";

const PORT = Number(process.env.PORT ?? 8787);
const LIVE_URL = process.env.SNAKE_LIVE_URL;

class SilentChatSource implements EventSource {
  onChatEvent(_handler: (event: ChatEvent) => void): void {
    // Keeps the WebSocket server alive without creating fake food/speed events.
  }

  async start(): Promise<void> {
    console.log("[server] no chat source configured; waiting for real YouTube integration");
  }

  stop(): void {
    // No running source to stop.
  }
}

function createEventSource(): EventSource {
  if (LIVE_URL) {
    console.log(`[server] reading real YouTube chat for: ${LIVE_URL}`);
    return new YouTubeChatSource(LIVE_URL);
  }
  return new SilentChatSource();
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

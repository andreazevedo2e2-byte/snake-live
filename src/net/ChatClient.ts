import type { ChatEvent } from "../chat/types";

const RECONNECT_DELAY_MS = 2000;

interface ServerMessage {
  type: "chat";
  event: ChatEvent;
}

/** Thin WebSocket client with auto-reconnect. The frontend never talks to
 * YouTube directly — it only consumes already-normalized, already-filtered
 * ChatEvents from the local backend (server/index.ts). */
export function connectChatClient(url: string, onEvent: (event: ChatEvent) => void): void {
  const socket = new WebSocket(url);

  socket.addEventListener("message", (raw) => {
    try {
      const msg = JSON.parse(raw.data) as ServerMessage;
      if (msg.type === "chat") onEvent(msg.event);
    } catch (err) {
      console.error("[ChatClient] malformed message from server:", err);
    }
  });

  socket.addEventListener("close", () => {
    setTimeout(() => connectChatClient(url, onEvent), RECONNECT_DELAY_MS);
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

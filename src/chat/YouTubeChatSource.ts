import { LiveChat } from "youtube-chat";
import type { ChatItem } from "youtube-chat/dist/types/data";
import { normalize } from "./normalize";
import { isAllowed } from "./contentFilter";
import type { ChatEvent, EventSource, RawChatItem } from "./types";

function toRawChatItem(item: ChatItem): RawChatItem {
  return {
    id: item.id,
    author: {
      name: item.author.name,
      channelId: item.author.channelId,
      thumbnail: item.author.thumbnail ? { url: item.author.thumbnail.url } : undefined,
    },
    message: item.message.map((run) =>
      "text" in run ? { text: run.text } : { emojiText: run.emojiText }
    ),
    superchat: item.superchat
      ? { amount: item.superchat.amount, color: item.superchat.color }
      : undefined,
    isMembership: item.isMembership,
    isModerator: item.isModerator,
    isOwner: item.isOwner,
  };
}

/** Extracts a YouTube live/video ID out of a pasted watch URL, or returns the
 * input unchanged if it already looks like a bare ID. */
export function parseLiveId(urlOrId: string): { liveId: string } {
  try {
    const url = new URL(urlOrId);
    const v = url.searchParams.get("v");
    if (v) return { liveId: v };
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last) return { liveId: last };
  } catch {
    // Not a URL — treat the input as a bare ID.
  }
  return { liveId: urlOrId };
}

/**
 * Reads a YouTube live chat by scraping the live page (via the `youtube-chat`
 * library) instead of calling the official API — no API key, no OAuth, no
 * 10k/day quota. See docs/superpowers/specs/2026-06-23-snake-live-design.md
 * section 2.3 for the trade-off rationale. This class is intentionally thin:
 * the third-party scraper is not unit-tested, only normalize()/isAllowed()
 * (which it delegates to) are.
 */
export class YouTubeChatSource implements EventSource {
  private readonly liveChat: LiveChat;
  private handlers: Array<(event: ChatEvent) => void> = [];

  constructor(liveUrlOrId: string) {
    this.liveChat = new LiveChat(parseLiveId(liveUrlOrId));
    this.liveChat.on("chat", (item) => {
      const event = normalize(toRawChatItem(item));
      if (!isAllowed(event)) return;
      for (const handler of this.handlers) handler(event);
    });
    this.liveChat.on("error", (err) => {
      console.error("[YouTubeChatSource] scraper error:", err);
    });
  }

  async start(): Promise<void> {
    const ok = await this.liveChat.start();
    if (!ok) throw new Error("YouTubeChatSource: failed to start (live not found or ended?)");
  }

  stop(): void {
    this.liveChat.stop();
  }

  onChatEvent(handler: (event: ChatEvent) => void): void {
    this.handlers.push(handler);
  }
}

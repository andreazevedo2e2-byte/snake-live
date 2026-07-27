import { LiveChat } from "youtube-chat";
import type { ChatItem } from "youtube-chat/dist/types/data";
import { normalize } from "./normalize";
import { isAllowed } from "./contentFilter";
import { DEFAULT_RETRY_POLICY, hasExhaustedRetries, retryDelayMs, type RetryPolicy } from "./retryPolicy";
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
 * (which it delegates to) are; the retry backoff logic lives in the tested,
 * pure retryPolicy.ts module instead.
 *
 * #110: a transient scraper failure (network blip, YouTube hiccup) used to
 * take the chat feed down for the rest of the live with no recovery. Both a
 * failed start() and a mid-stream "error" event now schedule a restart with
 * exponential backoff; a real incoming chat message resets the attempt
 * counter (proof the connection is healthy again). After maxAttempts
 * consecutive failures it gives up and logs clearly — the live keeps running
 * silently rather than crashing, same effective behavior as SNAKE_CHAT=silent.
 */
export class YouTubeChatSource implements EventSource {
  private liveChat: LiveChat;
  private handlers: Array<(event: ChatEvent) => void> = [];
  private attempt = 0;
  private stopped = false;
  private restartHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly liveUrlOrId: string,
    private readonly policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {
    this.liveChat = this.createLiveChat();
  }

  private createLiveChat(): LiveChat {
    const liveChat = new LiveChat(parseLiveId(this.liveUrlOrId));
    liveChat.on("chat", (item) => {
      this.attempt = 0;
      const event = normalize(toRawChatItem(item));
      if (!isAllowed(event)) return;
      for (const handler of this.handlers) handler(event);
    });
    liveChat.on("error", (err) => {
      console.error("[YouTubeChatSource] scraper error:", err);
      this.scheduleRestart();
    });
    return liveChat;
  }

  private scheduleRestart(): void {
    if (this.stopped) return;
    if (hasExhaustedRetries(this.attempt, this.policy)) {
      console.error(
        `[YouTubeChatSource] giving up after ${this.attempt} failed attempts — chat stays silent for the rest of this run.`,
      );
      return;
    }
    const delay = retryDelayMs(this.attempt, this.policy);
    this.attempt += 1;
    console.warn(`[YouTubeChatSource] retrying in ${delay}ms (attempt ${this.attempt}/${this.policy.maxAttempts})`);
    this.restartHandle = setTimeout(() => {
      if (this.stopped) return;
      this.liveChat = this.createLiveChat();
      this.start().catch((err) => {
        console.error("[YouTubeChatSource] restart attempt failed:", err);
        this.scheduleRestart();
      });
    }, delay);
  }

  async start(): Promise<void> {
    const ok = await this.liveChat.start();
    if (!ok) {
      console.error("[YouTubeChatSource] failed to start (live not found or ended?) — scheduling retry");
      this.scheduleRestart();
      return;
    }
    this.attempt = 0;
  }

  stop(): void {
    this.stopped = true;
    if (this.restartHandle) clearTimeout(this.restartHandle);
    this.liveChat.stop();
  }

  onChatEvent(handler: (event: ChatEvent) => void): void {
    this.handlers.push(handler);
  }
}

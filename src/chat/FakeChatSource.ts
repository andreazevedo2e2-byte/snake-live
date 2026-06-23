import type { ChatEvent, EventSource } from "./types";

const FAKE_AUTHORS = [
  "Ana", "Bruno", "Carla", "Diego", "Elena", "Felix",
  "Gabi", "Hugo", "Iris", "Joao", "Kira", "Leo",
];

const FAKE_MESSAGES = [
  "go go go!",
  "left left left",
  "nooo almost",
  "let's go",
  "🔥🔥🔥",
  "you got this",
  "watch the wall!",
  "gg",
];

/** Pure, deterministic generator used both by FakeChatSource's timer loop and
 * by tests — same index always produces the same fake comment. */
export function nextFakeChatEvent(index: number): ChatEvent {
  const author = FAKE_AUTHORS[index % FAKE_AUTHORS.length];
  const text = FAKE_MESSAGES[index % FAKE_MESSAGES.length];
  const isMember = index % 5 === 0;
  const hasSuperchat = index % 11 === 0;

  return {
    id: `fake-${index}`,
    authorName: author,
    authorChannelId: `fake-channel-${index % FAKE_AUTHORS.length}`,
    avatarUrl: `https://i.pravatar.cc/150?u=fake-${index % FAKE_AUTHORS.length}`,
    text,
    isMember,
    isMod: false,
    isOwner: false,
    superchat: hasSuperchat ? { amount: "$2.00", color: "#1de9b6" } : undefined,
  };
}

/** Simulator used in dev/rehearsal/tests instead of the real YouTube scraper.
 * Emits a synthetic comment on a fixed interval through the same EventSource
 * interface the real source uses, so the rest of the app cannot tell them apart. */
export class FakeChatSource implements EventSource {
  private handlers: Array<(event: ChatEvent) => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private index = 0;

  constructor(private readonly intervalMs: number = 1500) {}

  async start(): Promise<void> {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const event = nextFakeChatEvent(this.index++);
      for (const handler of this.handlers) handler(event);
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  onChatEvent(handler: (event: ChatEvent) => void): void {
    this.handlers.push(handler);
  }
}

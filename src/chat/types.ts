export interface SuperChat {
  amount: string;
  color: string;
}

export interface ChatEvent {
  id: string;
  authorName: string;
  authorChannelId: string;
  avatarUrl: string;
  text: string;
  isMember: boolean;
  isMod: boolean;
  isOwner: boolean;
  superchat?: SuperChat;
}

/** Raw shape produced by the `youtube-chat` scraper's `ChatItem`. Kept minimal
 * and local so the rest of the app never imports the third-party library's
 * types directly. */
export interface RawChatItem {
  id: string;
  author: {
    name: string;
    channelId: string;
    thumbnail?: { url: string };
  };
  message: Array<{ text: string } | { emojiText: string }>;
  superchat?: { amount: string; color: string };
  isMembership: boolean;
  isModerator: boolean;
  isOwner: boolean;
}

/** Abstraction over "where chat events come from" — a real scraper or a fake
 * source used in dev/tests/rehearsal. The game never knows which one is wired up. */
export interface EventSource {
  start(): Promise<void>;
  stop(): void;
  onChatEvent(handler: (event: ChatEvent) => void): void;
}

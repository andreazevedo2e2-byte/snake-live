import type { ChatEvent, RawChatItem } from "./types";

export const DEFAULT_AVATAR_URL = "/assets/avatars/default.svg";

function isEmojiRun(run: RawChatItem["message"][number]): run is { emojiText: string } {
  return "emojiText" in run;
}

export function normalize(raw: RawChatItem): ChatEvent {
  const text = raw.message.map((run) => (isEmojiRun(run) ? run.emojiText : run.text)).join("");

  return {
    id: raw.id,
    authorName: raw.author.name,
    authorChannelId: raw.author.channelId,
    avatarUrl: raw.author.thumbnail?.url ?? DEFAULT_AVATAR_URL,
    text,
    isMember: raw.isMembership,
    isMod: raw.isModerator,
    isOwner: raw.isOwner,
    superchat: raw.superchat ? { amount: raw.superchat.amount, color: raw.superchat.color } : undefined,
  };
}

/**
 * The typing half of @mentions: noticing that the caret is inside "@so" and
 * swapping it for the chosen name. Pure, so the edge cases are tested directly.
 */

export interface MentionQuery {
  /** Index of the "@". */
  start: number;
  /** What has been typed after it. */
  query: string;
}

/**
 * The mention being typed at the caret, if any.
 *
 * An "@" only starts a mention at the beginning of the text or after
 * whitespace, so an email address such as "ada@example.com" does not open the
 * suggestion list.
 */
export function activeMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@([^\s@]{0,30})$/.exec(before);
  if (!match) return null;
  return { start: before.length - match[2]!.length - 1, query: match[2]! };
}

/** Replaces "@que" with "@Full Name " and says where the caret should land. */
export function applyMention(
  text: string,
  mention: MentionQuery,
  caret: number,
  name: string
): { text: string; caret: number } {
  const inserted = `@${name} `;
  const next = text.slice(0, mention.start) + inserted + text.slice(caret);
  return { text: next, caret: mention.start + inserted.length };
}

/** Members whose name has a word starting with the query, best matches first. */
export function matchMembers<T extends { name: string }>(
  members: readonly T[],
  query: string,
  limit = 6
): T[] {
  const needle = query.toLowerCase();
  const scored = members
    .map((member) => {
      const name = member.name.toLowerCase();
      if (name.startsWith(needle)) return { member, score: 0 };
      if (name.split(/\s+/).some((word) => word.startsWith(needle)))
        return { member, score: 1 };
      return null;
    })
    .filter((entry): entry is { member: T; score: number } => entry !== null);
  scored.sort((a, b) => a.score - b.score || a.member.name.localeCompare(b.member.name));
  return scored.slice(0, limit).map((entry) => entry.member);
}

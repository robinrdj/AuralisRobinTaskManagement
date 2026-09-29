import { z } from "zod";
import { isoDateTimeSchema } from "./task.js";

/**
 * Comments and @mentions.
 *
 * A mention is stored as `@[Name](userId)` rather than as bare `@Name`:
 * names are not unique and can change, while the id always resolves to the
 * one person who was meant. The name is kept alongside so the text still
 * reads sensibly if that person later leaves the board.
 */

export const COMMENT_MAX_LENGTH = 5_000;

export const commentBodySchema = z.object({
  body: z.string().trim().min(1, "A comment cannot be empty").max(COMMENT_MAX_LENGTH),
});

export const commentSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  boardId: z.string().uuid(),
  authorId: z.string().uuid().nullable(),
  authorName: z.string().nullable(),
  authorColor: z.string().nullable(),
  body: z.string(),
  createdAt: isoDateTimeSchema,
  /** Null until the comment is edited. */
  editedAt: isoDateTimeSchema.nullable(),
});

export type Comment = z.infer<typeof commentSchema>;

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** Matches one stored mention; a fresh instance per call, since `g` regexes hold state. */
function mentionPattern(): RegExp {
  return new RegExp(`@\\[([^\\]\\n]{1,80})\\]\\((${UUID})\\)`, "g");
}

/** The stored form of a mention. Square brackets would end the token early, so they are dropped. */
export function formatMention(name: string, userId: string): string {
  return `@[${name.replace(/[[\]\n]/g, "").slice(0, 80)}](${userId})`;
}

/** Every distinct user id mentioned in a comment body, in order of first appearance. */
export function extractMentionIds(body: string): string[] {
  const ids: string[] = [];
  for (const match of body.matchAll(mentionPattern())) {
    const id = match[2]!.toLowerCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export type CommentSegment =
  { type: "text"; text: string } | { type: "mention"; name: string; userId: string };

/** Splits a body into plain text and mentions, for rendering. */
export function splitMentions(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(mentionPattern())) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: body.slice(last, start) });
    segments.push({ type: "mention", name: match[1]!, userId: match[2]!.toLowerCase() });
    last = start + match[0].length;
  }
  if (last < body.length) segments.push({ type: "text", text: body.slice(last) });
  return segments;
}

/**
 * The readable form a person types and edits: `@[Ada](id)` becomes `@Ada`.
 * Returns the mentions found, so an edit can turn them back into tokens.
 */
export function mentionsToPlainText(body: string): {
  text: string;
  mentions: { name: string; userId: string }[];
} {
  const mentions: { name: string; userId: string }[] = [];
  const text = splitMentions(body)
    .map((segment) => {
      if (segment.type === "text") return segment.text;
      if (!mentions.some((mention) => mention.userId === segment.userId)) {
        mentions.push({ name: segment.name, userId: segment.userId });
      }
      return `@${segment.name}`;
    })
    .join("");
  return { text, mentions };
}

/**
 * The reverse: every `@Name` for a person picked from the suggestions becomes
 * a stored mention. Longer names go first, so "@Ada Lovelace" is not claimed
 * by a shorter "@Ada" that happens to be its prefix.
 */
export function plainTextToMentions(
  text: string,
  mentions: readonly { name: string; userId: string }[]
): string {
  const byName = new Map(mentions.map((mention) => [mention.name, mention.userId]));
  if (byName.size === 0) return text;

  // One pass with an alternation, longest name first: the regex engine tries
  // the alternatives in order, and text it has replaced is never rescanned.
  const names = [...byName.keys()]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(${names.join("|")})`, "g");
  return text.replace(pattern, (_, name: string) => formatMention(name, byName.get(name)!));
}

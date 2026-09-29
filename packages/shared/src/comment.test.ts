import { describe, expect, it } from "vitest";
import {
  extractMentionIds,
  formatMention,
  mentionsToPlainText,
  plainTextToMentions,
  splitMentions,
} from "./comment.js";

const ADA = "3f2b8c1e-7d4a-4e9b-9c1a-2b3c4d5e6f70";
const GRACE = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("mentions", () => {
  it("formats and extracts a mention", () => {
    const body = `Can you check this ${formatMention("Ada", ADA)}?`;
    expect(body).toBe(`Can you check this @[Ada](${ADA})?`);
    expect(extractMentionIds(body)).toEqual([ADA]);
  });

  it("returns each person once, in order of first mention", () => {
    const body = `${formatMention("Grace", GRACE)} and ${formatMention("Ada", ADA)}, then ${formatMention("Grace", GRACE)} again`;
    expect(extractMentionIds(body)).toEqual([GRACE, ADA]);
  });

  it("ignores text that only looks like a mention", () => {
    expect(extractMentionIds("email me @ home, or @[Ada](not-an-id)")).toEqual([]);
  });

  it("strips brackets from a name so the token cannot be broken", () => {
    expect(formatMention("Ada [admin]", ADA)).toBe(`@[Ada admin](${ADA})`);
  });

  it("splits a body into text and mention segments", () => {
    expect(splitMentions(`Hi ${formatMention("Ada", ADA)}!`)).toEqual([
      { type: "text", text: "Hi " },
      { type: "mention", name: "Ada", userId: ADA },
      { type: "text", text: "!" },
    ]);
  });

  it("keeps a body with no mentions as a single segment", () => {
    expect(splitMentions("plain")).toEqual([{ type: "text", text: "plain" }]);
    expect(splitMentions("")).toEqual([]);
  });

  it("round-trips between stored and editable forms", () => {
    const stored = `${formatMention("Ada", ADA)} please pair with ${formatMention("Grace", GRACE)}`;
    const { text, mentions } = mentionsToPlainText(stored);
    expect(text).toBe("@Ada please pair with @Grace");
    expect(plainTextToMentions(text, mentions)).toBe(stored);
  });

  it("does not let a shorter name claim a longer one it prefixes", () => {
    const text = "@Ada Lovelace and @Ada";
    const result = plainTextToMentions(text, [
      { name: "Ada", userId: ADA },
      { name: "Ada Lovelace", userId: GRACE },
    ]);
    expect(result).toBe(
      `${formatMention("Ada Lovelace", GRACE)} and ${formatMention("Ada", ADA)}`
    );
  });

  it("drops a picked mention whose text was deleted before sending", () => {
    expect(plainTextToMentions("never mind", [{ name: "Ada", userId: ADA }])).toBe(
      "never mind"
    );
  });
});

import { describe, expect, it } from "vitest";
import { activeMentionQuery, applyMention, matchMembers } from "./mentionQuery";

describe("activeMentionQuery", () => {
  it("finds a mention being typed at the caret", () => {
    expect(activeMentionQuery("Hey @ad", 7)).toEqual({ start: 4, query: "ad" });
  });

  it("opens on a bare @ at the start", () => {
    expect(activeMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("ignores an @ inside an email address", () => {
    expect(activeMentionQuery("mail ada@example", 16)).toBeNull();
  });

  it("closes once a space ends the word", () => {
    expect(activeMentionQuery("@ada ", 5)).toBeNull();
  });

  it("only looks at text before the caret", () => {
    expect(activeMentionQuery("@ad and more", 3)).toEqual({ start: 0, query: "ad" });
  });
});

describe("applyMention", () => {
  it("replaces the partial name and moves the caret after it", () => {
    const text = "Ask @ad about it";
    const result = applyMention(text, { start: 4, query: "ad" }, 7, "Ada Lovelace");
    expect(result.text).toBe("Ask @Ada Lovelace  about it");
    expect(result.caret).toBe(18);
  });
});

describe("matchMembers", () => {
  const members = [{ name: "Grace Hopper" }, { name: "Ada Lovelace" }, { name: "Alan Turing" }];

  it("prefers names that start with the query", () => {
    expect(matchMembers(members, "a").map((m) => m.name)).toEqual([
      "Ada Lovelace",
      "Alan Turing",
    ]);
  });

  it("also matches the start of a later word", () => {
    expect(matchMembers(members, "hop").map((m) => m.name)).toEqual(["Grace Hopper"]);
  });

  it("lists everyone for an empty query, alphabetically", () => {
    expect(matchMembers(members, "").map((m) => m.name)).toEqual([
      "Ada Lovelace",
      "Alan Turing",
      "Grace Hopper",
    ]);
  });
});

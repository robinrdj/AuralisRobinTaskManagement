import { describe, expect, it } from "vitest";
import { isTypingTarget, SHORTCUTS } from "./useKeyboardShortcuts";

describe("isTypingTarget", () => {
  it("recognises the fields a shortcut must not steal from", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isTypingTarget(document.createElement(tag)), tag).toBe(true);
    }
  });

  it("treats contenteditable as typing", () => {
    const element = document.createElement("div");
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(element, "isContentEditable", { value: true });
    expect(isTypingTarget(element)).toBe(true);
  });

  it("leaves ordinary elements alone", () => {
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("SHORTCUTS", () => {
  it("documents every key the board actually handles", () => {
    const documented = SHORTCUTS.map((entry) => entry.keys);
    expect(documented).toContain("N");
    expect(documented).toContain("1 – 4");
    expect(documented).toContain("Ctrl K");
    expect(documented).toContain("?");
  });

  it("gives each entry a description", () => {
    for (const entry of SHORTCUTS) {
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.keys.length).toBeGreaterThan(0);
    }
  });

  it("lists no duplicates", () => {
    const keys = SHORTCUTS.map((entry) => entry.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

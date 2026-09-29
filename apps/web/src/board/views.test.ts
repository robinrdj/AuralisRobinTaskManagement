import { describe, expect, it } from "vitest";
import type { SavedView } from "@auralis/shared";
import { EMPTY_FILTERS } from "@/store/uiSlice";
import { viewMatches } from "./views";

function view(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: "view",
    boardId: "board",
    ownerId: "me",
    ownerName: "Me",
    name: "A view",
    filters: { ...EMPTY_FILTERS },
    sortBy: "position",
    sortDirection: "asc",
    shared: false,
    ...overrides,
  };
}

describe("viewMatches", () => {
  it("matches identical filters and sort", () => {
    expect(viewMatches(view(), { ...EMPTY_FILTERS }, "position", "asc")).toBe(true);
  });

  it("ignores the order of chosen values and search whitespace", () => {
    const saved = view({
      filters: { ...EMPTY_FILTERS, priorities: ["high", "urgent"], search: "login" },
    });
    const current = {
      ...EMPTY_FILTERS,
      priorities: ["urgent", "high"] as const,
      search: " Login ",
    };
    expect(
      viewMatches(saved, { ...current, priorities: [...current.priorities] }, "position", "asc")
    ).toBe(true);
  });

  it("notices a different sort", () => {
    expect(viewMatches(view(), { ...EMPTY_FILTERS }, "dueDate", "asc")).toBe(false);
    expect(viewMatches(view(), { ...EMPTY_FILTERS }, "position", "desc")).toBe(false);
  });

  it("notices any extra filter", () => {
    expect(
      viewMatches(view(), { ...EMPTY_FILTERS, overdueOnly: true }, "position", "asc")
    ).toBe(false);
    expect(viewMatches(view(), { ...EMPTY_FILTERS, labelIds: ["x"] }, "position", "asc")).toBe(
      false
    );
  });
});

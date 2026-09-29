import { describe, expect, it } from "vitest";
import { groupLabels } from "./boardContext";

describe("groupLabels", () => {
  const a = { id: "a", boardId: "b", name: "Beta", color: "#000000" };
  const b = { id: "b", boardId: "b", name: "Alpha", color: "#000000" };

  it("groups labels by task, alphabetically", () => {
    const grouped = groupLabels(
      [a, b],
      [
        { taskId: "t1", labelId: "a" },
        { taskId: "t1", labelId: "b" },
        { taskId: "t2", labelId: "a" },
      ]
    );
    expect(grouped.get("t1")?.map((label) => label.name)).toEqual(["Alpha", "Beta"]);
    expect(grouped.get("t2")?.map((label) => label.name)).toEqual(["Beta"]);
  });

  it("drops an assignment whose label no longer exists", () => {
    expect(groupLabels([a], [{ taskId: "t1", labelId: "gone" }]).has("t1")).toBe(false);
  });
});

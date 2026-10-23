import { describe, expect, it } from "vitest";
import { applyOptionClick } from "./optionClick";

describe("option click rules", () => {
  it("selects on single click and clears on double click of the same option", () => {
    let selected: string | null = null;
    const first = applyOptionClick({ selectedOptionId: selected, optionId: "A", now: 1000, lastClick: null });
    selected = first.selectedOptionId;
    expect(selected).toBe("A");
    const second = applyOptionClick({
      selectedOptionId: selected,
      optionId: "A",
      now: 1200,
      lastClick: first.lastClick,
    });
    expect(second.selectedOptionId).toBeNull();
  });

  it("replaces the selection when a different option is clicked", () => {
    const first = applyOptionClick({ selectedOptionId: null, optionId: "A", now: 1000, lastClick: null });
    const second = applyOptionClick({
      selectedOptionId: first.selectedOptionId,
      optionId: "B",
      now: 1100,
      lastClick: first.lastClick,
    });
    expect(second.selectedOptionId).toBe("B");
  });

  it("keeps the same selection when the second click is later than 350 ms", () => {
    const first = applyOptionClick({ selectedOptionId: null, optionId: "A", now: 1_000, lastClick: null });
    const second = applyOptionClick({
      selectedOptionId: first.selectedOptionId,
      optionId: "A",
      now: 1_351,
      lastClick: first.lastClick,
    });
    expect(second.selectedOptionId).toBe("A");
  });
});

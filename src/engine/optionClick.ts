export type ClickMemory = { optionId: string; at: number };

const DOUBLE_CLICK_MS = 350;

export function applyOptionClick(input: {
  selectedOptionId: string | null;
  optionId: string;
  now: number;
  lastClick: ClickMemory | null;
}): { selectedOptionId: string | null; lastClick: ClickMemory } {
  const isDouble =
    input.selectedOptionId === input.optionId &&
    input.lastClick?.optionId === input.optionId &&
    input.now - (input.lastClick?.at ?? 0) <= DOUBLE_CLICK_MS;

  if (isDouble) {
    return { selectedOptionId: null, lastClick: { optionId: input.optionId, at: 0 } };
  }

  return {
    selectedOptionId: input.optionId,
    lastClick: { optionId: input.optionId, at: input.now },
  };
}

import { describe, expect, it } from "vitest";
import { displayInstrument, displayInstruments, normalizeInstrument, normalizeInstruments } from "@/lib/instruments";

describe("normalizeInstrument", () => {
  it("lowercases, trims and collapses inner whitespace", () => {
    expect(normalizeInstrument("  PIANO ")).toBe("piano");
    expect(normalizeInstrument("Electric   Guitar")).toBe("electric guitar");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeInstrument("   ")).toBe("");
  });
});

describe("normalizeInstruments", () => {
  it("normalises, de-duplicates and drops blanks, keeping first-seen order", () => {
    expect(normalizeInstruments(["Piano", " piano ", "Violin", "", "  ", "PIANO", "Drums"])).toEqual([
      "piano",
      "violin",
      "drums",
    ]);
  });

  it("handles an empty list", () => {
    expect(normalizeInstruments([])).toEqual([]);
  });
});

describe("displayInstrument(s)", () => {
  it("capitalises each word", () => {
    expect(displayInstrument("electric guitar")).toBe("Electric Guitar");
    expect(displayInstrument("piano")).toBe("Piano");
  });

  it("joins a list with commas", () => {
    expect(displayInstruments(["piano", "electric guitar"])).toBe("Piano, Electric Guitar");
    expect(displayInstruments([])).toBe("");
  });
});

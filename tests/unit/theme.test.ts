import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, isTheme, parseTheme, THEMES } from "@/lib/theme";

describe("themes", () => {
  it("offers the three themes, with Cobalt as the default", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["cobalt", "slate", "midnight"]);
    expect(DEFAULT_THEME).toBe("cobalt");
  });

  it("parseTheme returns a known theme unchanged", () => {
    expect(parseTheme("slate")).toBe("slate");
    expect(parseTheme("midnight")).toBe("midnight");
  });

  it("parseTheme falls back to the default for anything unknown", () => {
    expect(parseTheme("neon")).toBe("cobalt");
    expect(parseTheme("")).toBe("cobalt");
    expect(parseTheme(null)).toBe("cobalt");
    expect(parseTheme(undefined)).toBe("cobalt");
    expect(parseTheme("COBALT")).toBe("cobalt"); // case-sensitive, so this is the fallback
    expect(parseTheme("Slate")).toBe("cobalt");
  });

  it("isTheme is a strict check", () => {
    expect(isTheme("slate")).toBe(true);
    expect(isTheme("Slate")).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

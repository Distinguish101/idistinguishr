import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Anthropic SDK is replaced, so no real model call is ever made.
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { parse };
  },
}));

const profile = {
  bio: "Piano teacher for ten years, grades 1 to 8.",
  instruments: ["piano"],
  hourlyRateMinorUnits: 4500,
  credentials: "ABRSM Grade 8",
  formatsOffered: ["ONLINE"],
  locationText: null,
};

async function load(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules(); // the module reads its key and model once, at import
  return import("@/lib/vet-teacher-profile");
}

const saved = { key: process.env.ANTHROPIC_API_KEY, model: process.env.TEACHER_VETTING_MODEL };
beforeEach(() => {
  parse.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const [name, value] of [
    ["ANTHROPIC_API_KEY", saved.key],
    ["TEACHER_VETTING_MODEL", saved.model],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("vetTeacherProfile", () => {
  it("sends a profile for human review, without calling the model, when there is no API key", async () => {
    const { vetTeacherProfile } = await load({ ANTHROPIC_API_KEY: undefined });
    const result = await vetTeacherProfile(profile);
    expect(result.verdict).toBe("needs_review");
    expect(result.reason).toMatch(/ANTHROPIC_API_KEY not set/);
    expect(parse).not.toHaveBeenCalled();
  });

  it("returns the model's verdict when it answers properly", async () => {
    const { vetTeacherProfile } = await load({ ANTHROPIC_API_KEY: "key" });
    parse.mockResolvedValue({ parsed_output: { verdict: "approve", reason: "Specific and plausible." } });
    expect(await vetTeacherProfile(profile)).toEqual({ verdict: "approve", reason: "Specific and plausible." });
  });

  it("passes the profile as JSON, uses a structured-output schema, and defaults to Haiku", async () => {
    const { vetTeacherProfile } = await load({ ANTHROPIC_API_KEY: "key", TEACHER_VETTING_MODEL: undefined });
    parse.mockResolvedValue({ parsed_output: { verdict: "approve", reason: "ok" } });
    await vetTeacherProfile(profile);
    const call = parse.mock.calls[0][0];
    expect(call.model).toBe("claude-haiku-4-5");
    expect(JSON.parse(call.messages[0].content)).toEqual(profile);
    expect(call.output_config.format.type).toBe("json_schema");
    expect(call.output_config.format.schema.required).toEqual(["verdict", "reason"]);
  });

  it("lets the model be overridden by an environment setting", async () => {
    const { vetTeacherProfile } = await load({ ANTHROPIC_API_KEY: "key", TEACHER_VETTING_MODEL: "some-other-model" });
    parse.mockResolvedValue({ parsed_output: { verdict: "approve", reason: "ok" } });
    await vetTeacherProfile(profile);
    expect(parse.mock.calls[0][0].model).toBe("some-other-model");
  });

  it("fails closed to needs_review when the answer cannot be parsed", async () => {
    const { vetTeacherProfile } = await load({ ANTHROPIC_API_KEY: "key" });
    parse.mockResolvedValue({ parsed_output: null });
    const result = await vetTeacherProfile(profile);
    expect(result.verdict).toBe("needs_review");
    expect(result.reason).toMatch(/expected format/);
  });

  it("fails closed to needs_review when the call throws, and logs it", async () => {
    const { vetTeacherProfile } = await load({ ANTHROPIC_API_KEY: "key" });
    parse.mockRejectedValue(new Error("network down"));
    const result = await vetTeacherProfile(profile);
    expect(result.verdict).toBe("needs_review");
    expect(result.reason).toMatch(/call failed/);
    expect(console.error).toHaveBeenCalled();
  });
});

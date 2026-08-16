import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = process.env.TEACHER_VETTING_MODEL ?? "claude-opus-5";

export type VetResult = { verdict: "approve" | "needs_review"; reason: string };

const SYSTEM_PROMPT = `You are a first-pass content reviewer for teacher signups on IDistinguishR, a marketplace where private music teachers list profiles for students to book. A human admin reviews every profile you flag — you are not the final decision, you're triaging so obviously-fine profiles can go live immediately and only unclear ones wait for a human.

Approve a profile only when it reads like a real, specific music teacher: a bio that describes actual teaching experience or background (not empty, generic, or copy-pasted filler), credentials that plausibly relate to the stated instrument(s), and an hourly rate in a sane range for private lessons (not zero, negative, or absurdly high). Everything else — spam, gibberish, obvious placeholder text, credentials unrelated to the instrument, inappropriate or unsafe content, or anything you're genuinely unsure about — should go to needs_review. When in doubt, choose needs_review: a human looking at an easy approval costs little, a bad profile going live costs more.

Give a one-sentence reason either way. For an approval it can be brief. For needs_review, say specifically what looked off so the reviewing admin knows what to check.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    verdict: { type: "string" as const, enum: ["approve", "needs_review"] },
    reason: { type: "string" as const },
  },
  required: ["verdict", "reason"],
  additionalProperties: false,
};

// Called right after a teacher's Stripe onboarding completes, ahead of the
// existing manual /admin approval — never a replacement for it. On any
// failure (no API key, network error, unparseable response) this fails
// closed to needs_review rather than silently auto-approving, so the worst
// case is identical to how approval worked before this existed: the
// teacher sits PENDING until an admin looks at them.
export async function vetTeacherProfile(profile: {
  bio: string;
  instruments: string[];
  hourlyRateMinorUnits: number;
  credentials: string;
  formatsOffered: string[];
  locationText: string | null;
}): Promise<VetResult> {
  if (!client) {
    return { verdict: "needs_review", reason: "ANTHROPIC_API_KEY not set — automated vetting skipped." };
  }

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(profile) }],
    });

    const parsed = response.parsed_output as VetResult | null;
    if (!parsed) {
      return { verdict: "needs_review", reason: "Vetting model response didn't match the expected format." };
    }
    return parsed;
  } catch (err) {
    console.error("Automated teacher vetting call failed:", err);
    return { verdict: "needs_review", reason: "Automated vetting call failed — see server logs." };
  }
}

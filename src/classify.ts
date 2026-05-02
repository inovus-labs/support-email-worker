import { ALL_INTENTS, type Classification, type Env, type Intent } from "./types";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_BODY_CHARS = 4000;

const SYSTEM_PROMPT = `You classify inbound email for Inovus Labs (a student-led tech community running multiple open-source and research projects).
Return ONLY a single JSON object, no prose, no markdown, no code fences.

Schema:
{"intent": "<one of: support_question | collaboration | recruiting | media | spam | other>",
 "confidence": <number between 0 and 1>,
 "summary": "<one sentence, <=160 chars, plain text>"}

Intent definitions:
- support_question: a user asking how to use, set up, or troubleshoot one of our projects
- collaboration: someone proposing partnership, joint work, sponsorship, or contribution
- recruiting: someone asking to join the team, intern, or volunteer
- media: press, podcast, interview, or speaking-engagement requests
- spam: unsolicited marketing, SEO offers, link-building, or obvious junk
- other: anything that does not clearly fit above`;

function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && (ALL_INTENTS as readonly string[]).includes(value);
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function classify(
  env: Env,
  input: { subject: string; body: string },
): Promise<Classification> {
  const fallback: Classification = {
    intent: "other",
    confidence: 0,
    summary: input.subject.slice(0, 160) || "(no subject)",
  };

  try {
    const userMessage = [
      `Subject: ${input.subject}`,
      "",
      "Body:",
      input.body.slice(0, MAX_BODY_CHARS),
    ].join("\n");

    const result = (await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
    })) as { response?: string };

    if (!result.response) return fallback;

    const parsed = extractJson(result.response) as {
      intent?: unknown;
      confidence?: unknown;
      summary?: unknown;
    };

    const intent = isIntent(parsed.intent) ? parsed.intent : "other";
    const confidence =
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0;
    const summary =
      typeof parsed.summary === "string" && parsed.summary.length > 0
        ? parsed.summary.slice(0, 160)
        : fallback.summary;

    return { intent, confidence, summary };
  } catch (err) {
    console.error("classify failed", err);
    return fallback;
  }
}

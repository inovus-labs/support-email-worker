import { EmailMessage } from "cloudflare:email";
import { buildAutoReply } from "./templates/auto-reply";
import { buildTriageEmail } from "./templates/triage";
import type { Env } from "./types";

const SYSTEM = `You are drafting a brief, courteous reply on behalf of Inovus Labs Support. Inovus Labs is a student community at Kristu Jyoti College. Your reply should follow these guidelines:

Rules:
- 3 to 5 short sentences, plain text, no markdown.
- Address the sender by their first name when known.
- Acknowledge what they wrote concretely — not generic boilerplate.
- If they asked a question and you have a confident factual answer, give it briefly. Otherwise commit to a follow-up within 1–2 working days.
- Do NOT invent product details, links, names, prices, dates, or commitments you can't back up.
- Do NOT sign off — the email template adds the signature.
- Output strictly JSON: { "reply": "<reply body>" }`;

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    type: "object",
    properties: { reply: { type: "string", maxLength: 2000 } },
    required: ["reply"],
    additionalProperties: false,
  },
};

const FALLBACK_REPLY =
  "Thanks for reaching out — we've received your message. Someone from the team will get back to you within 1–2 working days.";

async function draftReply(
  env: Env,
  input: { senderName: string | null; subject: string; body: string },
): Promise<string> {
  try {
    const result = await (env.AI as any).run(env.AI_MODEL, {
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            `From: ${input.senderName ?? "Unknown"}`,
            `Subject: ${input.subject}`,
            "",
            "Body:",
            input.body.slice(0, 4000),
          ].join("\n"),
        },
      ],
      temperature: 0.4,
      response_format: RESPONSE_FORMAT,
    });
    const r = result.response;
    const data = typeof r === "string" ? JSON.parse(r) : r;
    if (typeof data.reply === "string" && data.reply.trim()) return data.reply.trim();
    return FALLBACK_REPLY;
  } catch (err) {
    console.error("draft failed", err);
    return FALLBACK_REPLY;
  }
}

export interface ProcessInput {
  projectSlug: string;
  senderName: string | null;
  senderAddress: string;
  subject: string;
  body: string;
  inReplyTo: string | null;
  replyFrom: string;
  mailFrom: string;
  teamInbox: string;
}

export async function process(env: Env, input: ProcessInput) {
  const replyBody = await draftReply(env, {
    senderName: input.senderName,
    subject: input.subject,
    body: input.body,
  });

  const replyMime = buildAutoReply({
    senderName: input.senderName,
    senderAddress: input.senderAddress,
    fromAddress: input.replyFrom,
    inReplyTo: input.inReplyTo,
    originalSubject: input.subject,
    body: replyBody,
  });

  const triageMime = buildTriageEmail({
    projectSlug: input.projectSlug,
    sender: { name: input.senderName, address: input.senderAddress },
    subject: input.subject,
    receivedAt: Date.now(),
    bodyPreview: input.body.slice(0, 4000),
    draftedReply: replyBody,
    fromAddress: input.mailFrom,
    toAddress: input.teamInbox,
  });

  return {
    reply: new EmailMessage(input.replyFrom, input.senderAddress, replyMime.asRaw()),
    triage: new EmailMessage(input.mailFrom, input.teamInbox, triageMime.asRaw()),
  };
}

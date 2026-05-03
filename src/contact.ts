import { EmailMessage } from "cloudflare:email";
import { getAgentByName } from "agents";
import type { Context } from "hono";
import { z } from "zod";
import { buildContactEmail } from "./templates";
import type { Env } from "./types";
import type { SupportAgent } from "./agent";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export const contactPayloadSchema = z.object({
  projectSlug: z.string().regex(SLUG_RE, "projectSlug must be a lowercase slug"),
  name: z.string().min(1).max(120),
  fromEmail: z.string().email().max(254),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(8000),
  turnstileToken: z.string().min(1).optional(),
});

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function verifyTurnstile(env: Env, token: string, remoteIp: string | null): Promise<boolean> {
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (remoteIp) form.append("remoteip", remoteIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("turnstile verify failed", err);
    return false;
  }
}

function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function handleContact(c: Context<{ Bindings: Env }>) {
  const env = c.env;

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const parsed = contactPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "invalid payload", issues: parsed.error.flatten() }, 400);
  }
  const payload = parsed.data;

  if (env.TURNSTILE_ENABLED === "true") {
    if (!payload.turnstileToken) {
      return c.json({ error: "turnstile token required" }, 400);
    }
    const remoteIp = c.req.header("CF-Connecting-IP") ?? null;
    const turnstileOk = await verifyTurnstile(env, payload.turnstileToken, remoteIp);
    if (!turnstileOk) {
      return c.json({ error: "turnstile verification failed" }, 403);
    }
  }

  const contactMime = buildContactEmail({
    projectSlug: payload.projectSlug,
    fromAddress: env.MAIL_FROM,
    toAddress: env.TEAM_INBOX,
    senderName: payload.name,
    senderEmail: payload.fromEmail,
    subject: payload.subject,
    message: payload.message,
    submittedAt: Date.now(),
  });

  let result;
  try {
    const agent = await getAgentByName<Env, SupportAgent>(env.SupportAgent, payload.projectSlug);
    result = await agent.processIncoming({
      rawBase64: utf8ToBase64(contactMime.asRaw()),
      fromAddress: payload.fromEmail,
      toAddress: env.TEAM_INBOX,
      projectSlug: payload.projectSlug,
      senderNameOverride: payload.name,
      senderAddressOverride: payload.fromEmail,
    });
  } catch (err) {
    console.error("contact processing failed", err, { projectSlug: payload.projectSlug });
    return c.json({ error: "failed to process message" }, 502);
  }

  try {
    await env.SEND.send(
      new EmailMessage(result.summary.from, result.summary.to, result.summary.raw),
    );
  } catch (err) {
    console.error("contact summary send failed", err, { projectSlug: payload.projectSlug });
    return c.json({ error: "failed to dispatch message" }, 502);
  }

  return c.json({ ok: true, intent: result.intent });
}

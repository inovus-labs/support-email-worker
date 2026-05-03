import { EmailMessage } from "cloudflare:email";
import { getAgentByName } from "agents";
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

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body: unknown, init: ResponseInit, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...(init.headers ?? {}),
    },
  });
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

export async function handleContact(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, { status: 405 }, origin);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse({ error: "invalid JSON" }, { status: 400 }, origin);
  }

  const parsed = contactPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonResponse(
      { error: "invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
      origin,
    );
  }
  const payload = parsed.data;

  if (env.TURNSTILE_ENABLED === "true") {
    if (!payload.turnstileToken) {
      return jsonResponse({ error: "turnstile token required" }, { status: 400 }, origin);
    }
    const remoteIp = request.headers.get("CF-Connecting-IP");
    const turnstileOk = await verifyTurnstile(env, payload.turnstileToken, remoteIp);
    if (!turnstileOk) {
      return jsonResponse({ error: "turnstile verification failed" }, { status: 403 }, origin);
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
    return jsonResponse({ error: "failed to process message" }, { status: 502 }, origin);
  }

  try {
    await env.SEND.send(
      new EmailMessage(result.summary.from, result.summary.to, result.summary.raw),
    );
  } catch (err) {
    console.error("contact summary send failed", err, { projectSlug: payload.projectSlug });
    return jsonResponse({ error: "failed to dispatch message" }, { status: 502 }, origin);
  }

  return jsonResponse({ ok: true, intent: result.intent }, { status: 200 }, origin);
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { process as processMail } from "./process";
import type { Env } from "./types";
import { verifyTurnstile } from "./utils";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const contactSchema = z.object({
  projectSlug: z.string().regex(SLUG_RE),
  name: z.string().min(1).max(120),
  fromEmail: z.string().email().max(254),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(8000),
  turnstileToken: z.string().min(1).optional(),
});

export const app = new Hono<{ Bindings: Env }>();

app.use(
  "/contact",
  cors({
    origin: (o) => o ?? "*",
    allowMethods: ["POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 86400,
  }),
);

app.get("/health", (c) => c.text("ok"));

app.post("/contact", async (c) => {
  const env = c.env;

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "invalid payload", issues: parsed.error.flatten() }, 400);
  }
  const p = parsed.data;

  if (env.TURNSTILE_ENABLED === "true") {
    const ip = c.req.header("CF-Connecting-IP") ?? null;
    if (!p.turnstileToken || !(await verifyTurnstile(env, p.turnstileToken, ip))) {
      return c.json({ error: "turnstile failed" }, 403);
    }
  }

  try {
    const { reply, triage } = await processMail(env, {
      projectSlug: p.projectSlug,
      senderName: p.name,
      senderAddress: p.fromEmail,
      subject: p.subject,
      body: p.message,
      inReplyTo: null,
      replyFrom: env.MAIL_FROM,
      mailFrom: env.MAIL_FROM,
      teamInbox: env.TEAM_INBOX,
    });
    await Promise.all([env.SEND.send(reply), env.SEND.send(triage)]);
    return c.json({ ok: true });
  } catch (err) {
    console.error("contact failed", err, { slug: p.projectSlug });
    return c.json({ error: "failed to dispatch" }, 502);
  }
});

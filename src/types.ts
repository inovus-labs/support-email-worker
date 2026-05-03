import type { z } from "zod";
import type { contactPayloadSchema } from "./contact";

export type Intent =
  | "support_question"
  | "collaboration"
  | "recruiting"
  | "media"
  | "spam"
  | "other";

export const ALL_INTENTS: readonly Intent[] = [
  "support_question",
  "collaboration",
  "recruiting",
  "media",
  "spam",
  "other",
] as const;

export interface Classification {
  intent: Intent;
  confidence: number;
  summary: string;
}

export type ContactPayload = z.infer<typeof contactPayloadSchema>;

export interface Env {
  AI: Ai;
  SEND: SendEmail;
  SupportAgent: DurableObjectNamespace;
  TURNSTILE_SECRET: string;
  TURNSTILE_ENABLED: string;
  MAIL_FROM: string;
  TEAM_INBOX: string;
}

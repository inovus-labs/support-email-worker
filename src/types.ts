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

export interface TicketRow {
  id: number;
  sender: string;
  subject: string;
  intent: Intent;
  received_at: number;
  message_id: string | null;
}

export type ContactPayload = z.infer<typeof contactPayloadSchema>;

export interface Env {
  AI: Ai;
  SEND: SendEmail;
  SupportAgent: DurableObjectNamespace;
  TURNSTILE_SECRET: string;
  SUPPORT_DOMAIN: string;
  SUPPORT_LOCAL_PART: string;
  NOREPLY_FROM: string;
  TEAM_BCC: string;
}

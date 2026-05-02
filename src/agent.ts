import { Agent } from "agents";
import PostalMime from "postal-mime";
import { classify } from "./classify";
import { buildAutoReply, buildTeamSummary } from "./templates";
import type { Env, Intent } from "./types";

interface ProcessInput {
  rawBase64: string;
  fromAddress: string;
  toAddress: string;
  projectSlug: string;
}

interface SendableMime {
  from: string;
  to: string;
  raw: string;
}

export interface ProcessResult {
  ticketId: number;
  ticketRef: string;
  intent: Intent;
  reply: SendableMime;
  summary: SendableMime;
  inReplyTo: string | null;
}

interface AgentState {
  totalTickets: number;
  lastError: string | null;
  lastErrorAt: number | null;
}

const INITIAL_STATE: AgentState = {
  totalTickets: 0,
  lastError: null,
  lastErrorAt: null,
};

function decodeBase64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class SupportAgent extends Agent<Env, AgentState> {
  override initialState: AgentState = INITIAL_STATE;

  override async onStart(): Promise<void> {
    this.sql`
      CREATE TABLE IF NOT EXISTS tickets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        sender      TEXT    NOT NULL,
        subject     TEXT    NOT NULL,
        intent      TEXT    NOT NULL,
        confidence  REAL    NOT NULL,
        summary     TEXT    NOT NULL,
        received_at INTEGER NOT NULL,
        message_id  TEXT
      )
    `;
  }

  async processIncoming(input: ProcessInput): Promise<ProcessResult> {
    const bytes = decodeBase64ToBytes(input.rawBase64);
    const parsed = await PostalMime.parse(bytes);

    const subject = parsed.subject?.trim() || "(no subject)";
    const body = parsed.text?.trim() || stripHtml(parsed.html ?? "") || "";
    const messageId = parsed.messageId ?? null;
    const senderName = parsed.from?.name?.trim() || null;
    const senderAddress = parsed.from?.address || input.fromAddress;
    const receivedAt = Date.now();

    const classification = await classify(this.env, { subject, body });

    const inserted = this.sql<{ id: number }>`
      INSERT INTO tickets (sender, subject, intent, confidence, summary, received_at, message_id)
      VALUES (${senderAddress}, ${subject}, ${classification.intent}, ${classification.confidence}, ${classification.summary}, ${receivedAt}, ${messageId})
      RETURNING id
    `;
    const ticketId = inserted[0]?.id ?? 0;

    this.setState({
      ...this.state,
      totalTickets: this.state.totalTickets + 1,
    });

    const { mime: replyMime, ticketRef } = buildAutoReply({
      ticketId,
      projectSlug: input.projectSlug,
      senderName,
      senderAddress,
      fromAddress: input.toAddress,
      inReplyTo: messageId,
      intent: classification.intent,
    });

    const summaryMime = buildTeamSummary({
      ticketId,
      ticketRef,
      projectSlug: input.projectSlug,
      classification,
      sender: { name: senderName, address: senderAddress },
      subject,
      receivedAt,
      bodyPreview: body.slice(0, 4000),
      fromAddress: this.env.NOREPLY_FROM,
      toAddress: this.env.TEAM_BCC,
    });

    return {
      ticketId,
      ticketRef,
      intent: classification.intent,
      inReplyTo: messageId,
      reply: {
        from: input.toAddress,
        to: senderAddress,
        raw: replyMime.asRaw(),
      },
      summary: {
        from: this.env.NOREPLY_FROM,
        to: this.env.TEAM_BCC,
        raw: summaryMime.asRaw(),
      },
    };
  }

  async recordError(message: string): Promise<void> {
    this.setState({
      ...this.state,
      lastError: message.slice(0, 500),
      lastErrorAt: Date.now(),
    });
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

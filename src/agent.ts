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
  senderNameOverride?: string | null;
  senderAddressOverride?: string;
}

interface SendableMime {
  from: string;
  to: string;
  raw: string;
}

export interface ProcessResult {
  intent: Intent;
  reply: SendableMime;
  summary: SendableMime;
  inReplyTo: string | null;
}

interface AgentState {
  lastError: string | null;
  lastErrorAt: number | null;
}

const INITIAL_STATE: AgentState = {
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

  async processIncoming(input: ProcessInput): Promise<ProcessResult> {
    const bytes = decodeBase64ToBytes(input.rawBase64);
    const parsed = await PostalMime.parse(bytes);

    const subject = parsed.subject?.trim() || "(no subject)";
    const body = parsed.text?.trim() || stripHtml(parsed.html ?? "") || "";
    const messageId = parsed.messageId ?? null;
    const senderName =
      input.senderNameOverride !== undefined
        ? input.senderNameOverride
        : parsed.from?.name?.trim() || null;
    const senderAddress =
      input.senderAddressOverride ?? parsed.from?.address ?? input.fromAddress;
    const receivedAt = Date.now();

    const classification = await classify(this.env, { subject, body });

    const replyMime = buildAutoReply({
      projectSlug: input.projectSlug,
      senderName,
      senderAddress,
      fromAddress: input.toAddress,
      inReplyTo: messageId,
      intent: classification.intent,
    });

    const summaryMime = buildTeamSummary({
      projectSlug: input.projectSlug,
      classification,
      sender: { name: senderName, address: senderAddress },
      subject,
      receivedAt,
      bodyPreview: body.slice(0, 4000),
      fromAddress: this.env.MAIL_FROM,
      toAddress: this.env.TEAM_INBOX,
    });

    return {
      intent: classification.intent,
      inReplyTo: messageId,
      reply: {
        from: input.toAddress,
        to: senderAddress,
        raw: replyMime.asRaw(),
      },
      summary: {
        from: this.env.MAIL_FROM,
        to: this.env.TEAM_INBOX,
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

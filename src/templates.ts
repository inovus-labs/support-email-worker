import { createMimeMessage } from "mimetext";
import type { Classification, Intent } from "./types";

const INTENT_BLURB: Record<Intent, string> = {
  support_question:
    "We've passed your question to the team working on this project — expect a reply within 1–2 working days.",
  collaboration:
    "Thanks for reaching out about a collaboration. The core team will review and get back to you shortly.",
  recruiting:
    "Thanks for your interest in joining Inovus. We'll be in touch with the next steps once we've reviewed your message.",
  media:
    "Thanks for getting in touch. Someone from the team will respond about your request soon.",
  spam: "We've received your message.",
  other: "We've received your message and will get back to you soon.",
};

export interface AutoReplyArgs {
  ticketId: number;
  projectSlug: string;
  senderName: string | null;
  senderAddress: string;
  fromAddress: string;
  inReplyTo: string | null;
  intent: Intent;
}

export function buildAutoReply(args: AutoReplyArgs) {
  const greeting = args.senderName ? `Hi ${args.senderName.split(/\s+/)[0]},` : "Hi,";
  const ticketRef = `INV-${args.projectSlug.toUpperCase()}-${args.ticketId}`;

  const body = [
    greeting,
    "",
    `Thanks for contacting Inovus Labs. We've received your message and logged it as ticket ${ticketRef}.`,
    "",
    INTENT_BLURB[args.intent],
    "",
    "If you need to add anything, just reply to this email and it will attach to the same ticket.",
    "",
    "— Inovus Labs Support",
    "https://inovuslabs.org",
  ].join("\n");

  const msg = createMimeMessage();
  msg.setSender({ name: "Inovus Labs Support", addr: args.fromAddress });
  msg.setRecipient(args.senderAddress);
  msg.setSubject(`[${ticketRef}] We got your message`);
  if (args.inReplyTo) {
    msg.setHeader("In-Reply-To", args.inReplyTo);
    msg.setHeader("References", args.inReplyTo);
  }
  msg.setHeader("Auto-Submitted", "auto-replied");
  msg.setHeader("X-Inovus-Ticket", ticketRef);
  msg.addMessage({ contentType: "text/plain", data: body });

  return { mime: msg, ticketRef };
}

export interface TeamSummaryArgs {
  ticketId: number;
  ticketRef: string;
  projectSlug: string;
  classification: Classification;
  sender: { name: string | null; address: string };
  subject: string;
  receivedAt: number;
  bodyPreview: string;
  fromAddress: string;
  toAddress: string;
}

export function buildTeamSummary(args: TeamSummaryArgs) {
  const senderLine = args.sender.name
    ? `${args.sender.name} <${args.sender.address}>`
    : args.sender.address;

  const body = [
    `Ticket: ${args.ticketRef}`,
    `Project: ${args.projectSlug}`,
    `Intent: ${args.classification.intent} (confidence ${args.classification.confidence.toFixed(2)})`,
    `From: ${senderLine}`,
    `Subject: ${args.subject}`,
    `Received: ${new Date(args.receivedAt).toISOString()}`,
    "",
    `Summary: ${args.classification.summary}`,
    "",
    "--- Original message ---",
    args.bodyPreview,
  ].join("\n");

  const msg = createMimeMessage();
  msg.setSender({ name: "Inovus Email Worker", addr: args.fromAddress });
  msg.setRecipient(args.toAddress);
  msg.setSubject(
    `[Inovus Support][${args.projectSlug}] ${args.ticketRef} ${args.classification.intent}: ${args.subject}`,
  );
  msg.setHeader("Reply-To", args.sender.address);
  msg.setHeader("X-Inovus-Ticket", args.ticketRef);
  msg.addMessage({ contentType: "text/plain", data: body });

  return msg;
}

export interface ContactEmailArgs {
  projectSlug: string;
  fromAddress: string;
  toAddress: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  submittedAt: number;
}

export function buildContactEmail(args: ContactEmailArgs) {
  const body = [
    `Submitted via the ${args.projectSlug} contact form on ${new Date(args.submittedAt).toISOString()}.`,
    "",
    `Name:    ${args.senderName}`,
    `Email:   ${args.senderEmail}`,
    `Project: ${args.projectSlug}`,
    `Subject: ${args.subject}`,
    "",
    "Message:",
    args.message,
  ].join("\n");

  const msg = createMimeMessage();
  msg.setSender({ name: `${args.senderName} (via contact form)`, addr: args.fromAddress });
  msg.setRecipient(args.toAddress);
  msg.setSubject(`[${args.projectSlug}] ${args.subject}`);
  msg.setHeader("Reply-To", args.senderEmail);
  msg.setHeader("X-Inovus-Sender-Name", args.senderName);
  msg.setHeader("X-Inovus-Source", "contact-form");
  msg.setHeader("X-Inovus-Project", args.projectSlug);
  msg.addMessage({ contentType: "text/plain", data: body });

  return msg;
}

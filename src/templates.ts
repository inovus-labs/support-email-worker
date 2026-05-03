import { createMimeMessage, Mailbox } from "mimetext";
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

const INTENT_LABEL: Record<Intent, string> = {
  support_question: "Support",
  collaboration: "Collaboration",
  recruiting: "Recruiting",
  media: "Media",
  spam: "Spam",
  other: "Other",
};

const INTENT_BADGE: Record<Intent, string> = {
  support_question: "#2563eb",
  collaboration: "#7c3aed",
  recruiting: "#0d9488",
  media: "#d97706",
  spam: "#6b7280",
  other: "#374151",
};

const BRAND_NAME = "Inovus Labs";
const BRAND_URL = "https://inovuslabs.org";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlShell(preheader: string, contentHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(BRAND_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f5f7;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 28px;background:#0f172a;color:#f8fafc;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:14px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#f8fafc;">${escapeHtml(BRAND_NAME)}</td>
                <td align="right" style="font-size:12px;color:#94a3b8;">info@inovuslabs.org</td>
              </tr>
            </table>
          </td>
        </tr>
        ${contentHtml}
        <tr>
          <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
            <a href="${BRAND_URL}" style="color:#2563eb;text-decoration:none;">inovuslabs.org</a>
            &nbsp;·&nbsp; A student-led tech community
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export interface AutoReplyArgs {
  projectSlug: string;
  senderName: string | null;
  senderAddress: string;
  fromAddress: string;
  inReplyTo: string | null;
  intent: Intent;
}

export function buildAutoReply(args: AutoReplyArgs) {
  const firstName = args.senderName ? args.senderName.split(/\s+/)[0]! : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const blurb = INTENT_BLURB[args.intent];

  const textBody = [
    greeting,
    "",
    "Thanks for contacting Inovus Labs. We've received your message.",
    "",
    blurb,
    "",
    "If you need to add anything, just reply to this email.",
    "",
    `— ${BRAND_NAME} Support`,
    BRAND_URL,
  ].join("\n");

  const htmlBody = htmlShell(
    "Thanks for contacting Inovus Labs — we've received your message.",
    `
        <tr>
          <td style="padding:32px 28px 8px 28px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;font-weight:600;color:#111827;">${escapeHtml(greeting)}</h1>
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">
              Thanks for contacting <strong>${escapeHtml(BRAND_NAME)}</strong>. We've received your message and someone from the team will be in touch.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 8px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid #2563eb;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#374151;">
                  ${escapeHtml(blurb)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px 28px;">
            <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#6b7280;">
              If you need to add anything, just reply to this email.
            </p>
            <p style="margin:18px 0 0 0;font-size:14px;line-height:1.6;color:#111827;">— ${escapeHtml(BRAND_NAME)} Support</p>
          </td>
        </tr>`,
  );

  const msg = createMimeMessage();
  msg.setSender({ name: `${BRAND_NAME} Support`, addr: args.fromAddress });
  msg.setRecipient(args.senderAddress);
  msg.setSubject("We got your message");
  if (args.inReplyTo) {
    msg.setHeader("In-Reply-To", args.inReplyTo);
    msg.setHeader("References", args.inReplyTo);
  }
  msg.setHeader("Auto-Submitted", "auto-replied");
  msg.addMessage({ contentType: "text/plain", data: textBody });
  msg.addMessage({ contentType: "text/html", data: htmlBody });

  return msg;
}

export interface TeamSummaryArgs {
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
  const senderName = args.sender.name?.trim() || "";
  const senderLine = senderName
    ? `${senderName} <${args.sender.address}>`
    : args.sender.address;
  const intentLabel = INTENT_LABEL[args.classification.intent];
  const badgeColor = INTENT_BADGE[args.classification.intent];
  const confidencePct = Math.round(args.classification.confidence * 100);
  const receivedIso = new Date(args.receivedAt).toISOString();

  const textBody = [
    `Project: ${args.projectSlug}`,
    `Intent: ${args.classification.intent} (confidence ${args.classification.confidence.toFixed(2)})`,
    `From: ${senderLine}`,
    `Subject: ${args.subject}`,
    `Received: ${receivedIso}`,
    "",
    `Summary: ${args.classification.summary}`,
    "",
    "--- Original message ---",
    args.bodyPreview,
  ].join("\n");

  const htmlBody = htmlShell(
    `${intentLabel} · ${args.projectSlug} · ${args.subject}`,
    `
        <tr>
          <td style="padding:24px 28px 8px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:8px;">
                  <span style="display:inline-block;padding:4px 10px;background:${badgeColor};color:#ffffff;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;border-radius:999px;">${escapeHtml(intentLabel)}</span>
                </td>
                <td style="padding-right:8px;">
                  <span style="display:inline-block;padding:4px 10px;background:#f3f4f6;color:#374151;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;border-radius:999px;">${escapeHtml(args.projectSlug)}</span>
                </td>
                <td>
                  <span style="font-size:12px;color:#6b7280;">${confidencePct}% confidence</span>
                </td>
              </tr>
            </table>
            <h1 style="margin:14px 0 0 0;font-size:18px;line-height:1.4;font-weight:600;color:#111827;">${escapeHtml(args.subject)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 28px 0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#374151;">
              <tr>
                <td width="80" style="padding:4px 0;color:#6b7280;">From</td>
                <td style="padding:4px 0;">
                  ${senderName ? `${escapeHtml(senderName)} ` : ""}<a href="mailto:${escapeHtml(args.sender.address)}" style="color:#2563eb;text-decoration:none;">&lt;${escapeHtml(args.sender.address)}&gt;</a>
                </td>
              </tr>
              <tr>
                <td width="80" style="padding:4px 0;color:#6b7280;">Received</td>
                <td style="padding:4px 0;">${escapeHtml(receivedIso)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 0 28px;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">AI summary</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#111827;">
                  ${escapeHtml(args.classification.summary)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 28px 28px;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Original message</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.55;color:#374151;white-space:pre-wrap;word-break:break-word;">${escapeHtml(args.bodyPreview)}</td>
              </tr>
            </table>
          </td>
        </tr>`,
  );

  const msg = createMimeMessage();
  msg.setSender({ name: "Inovus Email Worker", addr: args.fromAddress });
  msg.setRecipient(args.toAddress);
  msg.setSubject(
    `[Inovus Support][${args.projectSlug}] ${args.classification.intent}: ${args.subject}`,
  );
  msg.setHeader(
    "Reply-To",
    new Mailbox({ addr: args.sender.address, name: args.sender.name ?? "" }),
  );
  msg.addMessage({ contentType: "text/plain", data: textBody });
  msg.addMessage({ contentType: "text/html", data: htmlBody });

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
  msg.setHeader(
    "Reply-To",
    new Mailbox({ addr: args.senderEmail, name: args.senderName }),
  );
  msg.setHeader("X-Inovus-Sender-Name", args.senderName);
  msg.setHeader("X-Inovus-Source", "contact-form");
  msg.setHeader("X-Inovus-Project", args.projectSlug);
  msg.addMessage({ contentType: "text/plain", data: body });

  return msg;
}

import { createMimeMessage, Mailbox } from "mimetext";
import { escapeHtml, htmlShell } from "./shell";

export interface TriageEmailArgs {
  projectSlug: string;
  sender: { name: string | null; address: string };
  subject: string;
  receivedAt: number;
  bodyPreview: string;
  draftedReply: string;
  fromAddress: string;
  toAddress: string;
}

export function buildTriageEmail(args: TriageEmailArgs) {
  const senderName = args.sender.name?.trim() || "";
  const senderLine = senderName
    ? `${senderName} <${args.sender.address}>`
    : args.sender.address;
  const receivedIso = new Date(args.receivedAt).toISOString();
  const fromHtml = `${senderName ? `${escapeHtml(senderName)}<br>` : ""}<a href="mailto:${escapeHtml(args.sender.address)}" style="color:#4f46e5;font-weight:600;text-decoration:none;">${escapeHtml(args.sender.address)}</a>`;

  const textBody = [
    `Project: ${args.projectSlug}`,
    `From: ${senderLine}`,
    `Subject: ${args.subject}`,
    `Received: ${receivedIso}`,
    "",
    "--- Drafted reply ---",
    args.draftedReply,
    "",
    "--- Original message ---",
    args.bodyPreview,
  ].join("\n");

  const htmlBody = htmlShell(
    `${args.projectSlug} · ${args.subject}`,
    "New message · Triage",
    640,
    `
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <span style="display:inline-block;padding:6px 12px;font-size:11px;font-weight:700;text-transform:uppercase;color:#4f46e5;background:#eef2ff;border:1px solid #c7d2fe;border-radius:999px;">${escapeHtml(args.projectSlug)}</span>
            <h1 style="margin:12px 0 0 0;font-size:22px;font-weight:700;color:#0f172a;">${escapeHtml(args.subject)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 32px 24px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
              <tr><td style="padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;width:100px;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;vertical-align:top;">From</td>
                    <td style="padding:8px 0 8px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;vertical-align:top;">${fromHtml}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;vertical-align:top;">Received</td>
                    <td style="padding:8px 0 8px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;vertical-align:top;">${escapeHtml(receivedIso)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:12px;font-weight:700;text-transform:uppercase;color:#64748b;vertical-align:top;">Subject</td>
                    <td style="padding:8px 0 8px 16px;font-size:14px;color:#0f172a;vertical-align:top;">${escapeHtml(args.subject)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Suggested reply</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;">
              <tr><td style="padding:18px 20px;font-size:15px;line-height:1.7;color:#0f172a;white-space:pre-wrap;">${escapeHtml(args.draftedReply)}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 32px 32px;">
            <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Original message</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:12px;">
              <tr><td style="padding:18px 20px;font-family:Consolas,Monaco,monospace;font-size:13px;line-height:1.6;color:#475569;white-space:pre-wrap;word-break:break-word;">${escapeHtml(args.bodyPreview)}</td></tr>
            </table>
          </td>
        </tr>`,
  );

  const msg = createMimeMessage();
  msg.setSender({ name: "Inovus Email Worker", addr: args.fromAddress });
  msg.setRecipient(args.toAddress);
  msg.setSubject(`[Inovus][${args.projectSlug}] ${args.subject}`);
  msg.setHeader(
    "Reply-To",
    new Mailbox({ addr: args.sender.address, name: args.sender.name ?? "" }),
  );
  msg.addMessage({ contentType: "text/plain", data: textBody });
  msg.addMessage({ contentType: "text/html", data: htmlBody });

  return msg;
}

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
    `
        <tr>
          <td style="padding:24px 28px 8px 28px;">
            <span style="display:inline-block;padding:4px 10px;background:#f3f4f6;color:#374151;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;border-radius:999px;">${escapeHtml(args.projectSlug)}</span>
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
            <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Drafted reply</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-left:3px solid #2563eb;border-radius:8px;">
              <tr>
                <td style="padding:14px 16px;font-size:14px;line-height:1.65;color:#111827;white-space:pre-wrap;">${escapeHtml(args.draftedReply)}</td>
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
  msg.setSubject(`[Inovus][${args.projectSlug}] ${args.subject}`);
  msg.setHeader(
    "Reply-To",
    new Mailbox({ addr: args.sender.address, name: args.sender.name ?? "" }),
  );
  msg.addMessage({ contentType: "text/plain", data: textBody });
  msg.addMessage({ contentType: "text/html", data: htmlBody });

  return msg;
}

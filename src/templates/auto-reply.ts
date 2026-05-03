import { createMimeMessage } from "mimetext";
import { BRAND_NAME, BRAND_URL, escapeHtml, htmlShell } from "./shell";

export interface AutoReplyArgs {
  senderName: string | null;
  senderAddress: string;
  fromAddress: string;
  inReplyTo: string | null;
  originalSubject: string;
  body: string;
}

export function buildAutoReply(args: AutoReplyArgs) {
  const firstName = args.senderName ? args.senderName.split(/\s+/)[0]! : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const paragraphs = args.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const bodyHtml = paragraphs
    .map(
      (p, i) =>
        `<p style="margin:0 0 ${i < paragraphs.length - 1 ? "16" : "0"}px 0;font-size:16px;line-height:1.7;color:#475569;">${escapeHtml(p)}</p>`,
    )
    .join("");

  const autoNote = "This is an automated reply.";
  const footerNote = `Automated reply · Inovus Labs\n${autoNote}`;

  const textBody = [
    greeting,
    "",
    paragraphs.join("\n\n"),
    "",
    `— ${BRAND_NAME} Support`,
    BRAND_URL,
    "",
    "---",
    "",
    footerNote,
  ].join("\n");

  const htmlBody = htmlShell(
    paragraphs[0]?.slice(0, 120) ?? "Thanks for reaching out.",
    "Support",
    600,
    `
        <tr>
          <td style="padding:16px 32px 28px 32px;">
            <p style="margin:0 0 20px 0;font-size:22px;font-weight:700;color:#0f172a;">${escapeHtml(greeting)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
              <tr><td style="padding:24px 22px;">${bodyHtml}</td></tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
              <tr>
                <td width="4" style="width:4px;background:#4f46e5;border-radius:2px;">&nbsp;</td>
                <td style="padding-left:16px;">
                  <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(BRAND_NAME)} Support</p>
                  <p style="margin:4px 0 0 0;font-size:13px;color:#64748b;">Here if you need anything else.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
    footerNote,
  );

  const subject = args.originalSubject.toLowerCase().startsWith("re:")
    ? args.originalSubject
    : `Re: ${args.originalSubject}`;

  const msg = createMimeMessage();
  msg.setSender({ name: `${BRAND_NAME} Support`, addr: args.fromAddress });
  msg.setRecipient(args.senderAddress);
  msg.setSubject(subject);
  if (args.inReplyTo) {
    msg.setHeader("In-Reply-To", args.inReplyTo);
    msg.setHeader("References", args.inReplyTo);
  }
  msg.setHeader("Auto-Submitted", "auto-replied");
  msg.addMessage({ contentType: "text/plain", data: textBody });
  msg.addMessage({ contentType: "text/html", data: htmlBody });

  return msg;
}

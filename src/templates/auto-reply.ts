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

  const textBody = [
    greeting,
    "",
    paragraphs.join("\n\n"),
    "",
    `— ${BRAND_NAME} Support`,
    BRAND_URL,
  ].join("\n");

  const htmlBody = htmlShell(
    paragraphs[0]?.slice(0, 120) ?? "Thanks for reaching out.",
    `
        <tr>
          <td style="padding:32px 28px 8px 28px;">
            <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;font-weight:600;color:#111827;">${escapeHtml(greeting)}</h1>
            ${paragraphs
              .map(
                (p) =>
                  `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#374151;">${escapeHtml(p)}</p>`,
              )
              .join("\n            ")}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px 28px;">
            <p style="margin:18px 0 0 0;font-size:14px;line-height:1.6;color:#111827;">— ${escapeHtml(BRAND_NAME)} Support</p>
          </td>
        </tr>`,
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

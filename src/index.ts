import PostalMime from "postal-mime";
import { process as processMail } from "./process";
import { app } from "./routes";
import type { Env } from "./types";
import { stripHtml } from "./utils";

export default {
  fetch: app.fetch,

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    let result;
    try {
      const buf = await new Response(message.raw).arrayBuffer();
      const parsed = await PostalMime.parse(new Uint8Array(buf));
      result = await processMail(env, {
        projectSlug: "general",
        senderName: parsed.from?.name?.trim() || null,
        senderAddress: parsed.from?.address || message.from,
        subject: parsed.subject?.trim() || "(no subject)",
        body: parsed.text?.trim() || stripHtml(parsed.html ?? ""),
        inReplyTo: parsed.messageId ?? null,
        replyFrom: message.to,
        mailFrom: env.MAIL_FROM,
        teamInbox: env.TEAM_INBOX,
      });
    } catch (err) {
      console.error("email handler failed", err, { from: message.from });
      message.setReject("Temporary processing error. Please try again later.");
      return;
    }

    ctx.waitUntil(
      Promise.all([
        message.reply(result.reply).catch((err) => console.error("reply failed", err)),
        env.SEND.send(result.triage).catch((err) => console.error("triage failed", err)),
      ]),
    );
  },
} satisfies ExportedHandler<Env>;

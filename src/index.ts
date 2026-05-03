import { EmailMessage } from "cloudflare:email";
import { getAgentByName } from "agents";
import { handleContact } from "./contact";
import { projectSlugFor } from "./routing";
import type { Env } from "./types";
import type { ProcessResult, SupportAgent } from "./agent";

export { SupportAgent } from "./agent";

async function readAllToBase64(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < merged.length; i += CHUNK) {
    binary += String.fromCharCode(...merged.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/contact") {
      return handleContact(request, env);
    }
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  },

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const projectSlug = projectSlugFor(message.to, "general");

    let result: ProcessResult;
    try {
      const rawBase64 = await readAllToBase64(message.raw);
      const agent = await getAgentByName<Env, SupportAgent>(env.SupportAgent, projectSlug);
      result = await agent.processIncoming({
        rawBase64,
        fromAddress: message.from,
        toAddress: message.to,
        projectSlug,
      });
    } catch (err) {
      console.error("agent processing failed", err, { projectSlug, from: message.from });
      message.setReject("Temporary processing error. Please try again later.");
      return;
    }

    const tasks: Array<Promise<void>> = [];

    tasks.push(
      message
        .reply(new EmailMessage(result.reply.from, result.reply.to, result.reply.raw))
        .catch(async (err) => {
          console.error("auto-reply failed", err, { projectSlug });
          await recordError(env, projectSlug, `reply: ${stringifyError(err)}`);
        }),
    );

    tasks.push(
      env.SEND.send(
        new EmailMessage(result.summary.from, result.summary.to, result.summary.raw),
      ).catch(async (err) => {
        console.error("team summary failed", err, { projectSlug });
        await recordError(env, projectSlug, `summary: ${stringifyError(err)}`);
      }),
    );

    ctx.waitUntil(Promise.all(tasks).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;

async function recordError(env: Env, projectSlug: string, message: string): Promise<void> {
  try {
    const agent = await getAgentByName<Env, SupportAgent>(env.SupportAgent, projectSlug);
    await agent.recordError(message);
  } catch (err) {
    console.error("recordError failed", err);
  }
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

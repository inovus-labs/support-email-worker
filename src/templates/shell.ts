export const BRAND_NAME = "Inovus Labs";
export const BRAND_URL = "https://inovuslabs.org";
export const BRAND_EMAIL = "info@inovuslabs.org";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Wrapper table: pass inner &lt;tr&gt;… rows only. Optional footer note (plain text, multiple lines ok) shown above the site link. */
export function htmlShell(
  preheader: string,
  subtitle: string,
  width: number,
  contentHtml: string,
  footerNote?: string,
): string {
  const footerNoteHtml = footerNote
    ? `<p style="margin:0 0 14px 0;font-size:11px;line-height:1.55;color:#94a3b8;">${footerNote
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br>")}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(BRAND_NAME)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Roboto,-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#0f172a;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f8fafc;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="max-width:${width}px;width:100%;background:#fff;border-radius:16px;border:1px solid #e2e8f0;">
        <tr><td style="height:4px;background:#4f46e5;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:28px 32px;background:#eef2ff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <div style="font-size:20px;font-weight:700;color:#0f172a;">${escapeHtml(BRAND_NAME)}</div>
                  <div style="margin-top:6px;font-size:13px;color:#64748b;">${escapeHtml(subtitle)}</div>
                </td>
                <td align="right">
                  <a href="mailto:${escapeHtml(BRAND_EMAIL)}" style="padding:8px 14px;font-size:12px;font-weight:600;color:#4f46e5;text-decoration:none;border:1px solid #c7d2fe;border-radius:999px;background:#fff;">${escapeHtml(BRAND_EMAIL)}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        ${contentHtml}
        <tr>
          <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
            ${footerNoteHtml}
            <a href="${BRAND_URL}" style="color:#4f46e5;font-weight:600;text-decoration:none;">inovuslabs.org</a>
            &nbsp;&nbsp;·&nbsp;&nbsp; Student-led tech community
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

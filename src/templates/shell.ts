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

export function htmlShell(preheader: string, contentHtml: string): string {
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
                <td align="right" style="font-size:12px;color:#94a3b8;">${escapeHtml(BRAND_EMAIL)}</td>
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

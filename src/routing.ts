export interface ParsedAddress {
  localPart: string;
  projectSlug: string | null;
  domain: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function parseSubAddress(address: string): ParsedAddress | null {
  const trimmed = address.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  const plus = local.indexOf("+");
  if (plus === -1) {
    return { localPart: local, projectSlug: null, domain };
  }

  const base = local.slice(0, plus);
  const tag = local.slice(plus + 1);
  const projectSlug = SLUG_RE.test(tag) ? tag : null;

  return { localPart: base, projectSlug, domain };
}

export function projectSlugFor(address: string, fallback = "general"): string {
  const parsed = parseSubAddress(address);
  return parsed?.projectSlug ?? fallback;
}

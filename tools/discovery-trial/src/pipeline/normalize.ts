/** Canonical URL key for de-duplication: no scheme, www, fragment, utm_*, trailing index. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    for (const key of [...u.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) u.searchParams.delete(key);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/(index\.(html?|php|jsp))?$/i, "");
    const query = u.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** Whitespace- and width-insensitive text for quote matching. */
export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

/** True when the quote appears in the page text the model was given. */
export function quoteInText(quote: string, text: string): boolean {
  const q = normalizeText(quote);
  return q.length >= 4 && normalizeText(text).includes(q);
}

/**
 * Identity key for a person name. Latin names are order-insensitive
 * ("Xiang Wang" == "Wang Xiang"); CJK names drop spacing and separators.
 */
export function nameKey(name: string): string {
  const n = name.normalize("NFKC").toLowerCase().trim();
  if (/[a-z]/.test(n)) {
    return n
      .split(/[\s\-.,]+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  }
  return n.replace(/[\s·・.\-,，]/g, "");
}

export function affiliationMatches(
  candidate: string | null,
  aliases: string[],
): boolean {
  if (!candidate) return false;
  const c = normalizeText(candidate);
  return aliases.some((alias) => {
    const a = normalizeText(alias);
    return a.length > 0 && (c.includes(a) || a.includes(c));
  });
}

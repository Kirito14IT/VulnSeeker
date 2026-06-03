/**
 * Per-issue translation cache stored in localStorage.
 * Key format: `vulnseeker:translate:${issueId}:${target}`
 * Value: { text: string; ts: number }
 * TTL: 30 days
 */

const PREFIX = 'vulnseeker:translate:';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  text: string;
  ts: number;
}

export function getCachedTranslation(issueId: number | string, target: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${issueId}:${target}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.ts > TTL_MS) {
      window.localStorage.removeItem(`${PREFIX}${issueId}:${target}`);
      return null;
    }
    return entry.text;
  } catch {
    return null;
  }
}

export function setCachedTranslation(issueId: number | string, target: string, text: string): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { text, ts: Date.now() };
    window.localStorage.setItem(`${PREFIX}${issueId}:${target}`, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled; silently ignore.
  }
}

export function clearCachedTranslation(issueId: number | string, target: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${PREFIX}${issueId}:${target}`);
  } catch {
    // ignore
  }
}

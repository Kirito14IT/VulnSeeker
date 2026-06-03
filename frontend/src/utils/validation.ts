/**
 * GitHub repository URL validation — mirrors the backend parse_github_repo in api/tasks.py.
 */

/** Maximum length for a normalized repo URL (matches DB column String(512)). */
export const MAX_REPO_URL_LENGTH = 512;

const GITHUB_URL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/]+)$/i;

/**
 * Parse a GitHub repository input into the canonical "org/repo" form.
 * Mirrors the backend ``parse_github_repo`` in ``backend/api/tasks.py``.
 *
 * @returns The normalized "org/repo" string, or an empty string if the input is invalid.
 */
export function parseGithubRepo(url: string): string {
  if (!url) {
    return "";
  }

  let normalized = url.trim();

  // Remove .git suffix
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -4);
  }

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, "");

  // Try github.com URL pattern (optional protocol, optional www)
  const match = normalized.match(GITHUB_URL_RE);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }

  // Try plain org/repo format (exactly 2 parts, not starting with http)
  const parts = normalized.split("/");
  if (parts.length === 2 && !normalized.startsWith("http")) {
    return normalized;
  }

  return "";
}

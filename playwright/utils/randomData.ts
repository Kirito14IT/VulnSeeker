/**
 * Random test-data generators for E2E tests.
 *
 * Every registration test must use unique credentials to avoid
 * 409 CONFLICT errors from previous test runs against the same database.
 * Timestamp + random suffix guarantees uniqueness across parallel workers.
 */

/** Generate a unique username: test_user_<timestamp>_<random> */
export function randomUsername(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `test_user_${timestamp}_${randomSuffix}`;
}

/** Generate a unique email address */
export function randomEmail(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `test_${timestamp}_${randomSuffix}@example.com`;
}

/**
 * Generate a valid password (≥6 chars per backend validation).
 * Uses a readable prefix + random segment for uniqueness.
 */
export function randomPassword(): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `Pass_${randomPart}`;
}

/** One-shot generator for a full set of random registration credentials */
export function randomCredentials(): {
  username: string;
  email: string;
  password: string;
} {
  return {
    username: randomUsername(),
    email: randomEmail(),
    password: randomPassword(),
  };
}

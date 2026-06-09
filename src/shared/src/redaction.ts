/**
 * Sensitive data redaction for ForgeAdmin.
 *
 * Detects and replaces credentials, API keys, tokens, PII, and secrets
 * before content is sent to LLM models.
 */

export interface RedactionResult {
  text: string;
  redactionsApplied: number;
  unusable: boolean;
}

interface RedactionPattern {
  regex: RegExp;
  replacement: string;
}

const PATTERNS: RedactionPattern[] = [
  // AWS Access Keys (AKIA...)
  { regex: /AKIA[0-9A-Z]{16}/g, replacement: "[REDACTED:AWS_KEY]" },
  // AWS Secret Keys (40 char base64-ish)
  { regex: /(?<![A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g, replacement: "[REDACTED:AWS_SECRET]" },
  // Bearer tokens / JWTs
  { regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: "Bearer [REDACTED:TOKEN]" },
  // JWT-like tokens (three base64 segments)
  { regex: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: "[REDACTED:TOKEN]" },
  // SSN patterns
  { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[REDACTED:SSN]" },
  // Email addresses
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[REDACTED:EMAIL]" },
  // Connection strings with passwords
  { regex: /:\/\/([^:]+):([^@]+)@/g, replacement: "://$1:[REDACTED:PASSWORD]@" },
  // Generic password patterns
  { regex: /(?:password|passwd|pwd)\s*[=:]\s*\S+/gi, replacement: "password=[REDACTED:PASSWORD]" },
  // Generic token/key patterns
  { regex: /(?:token|api_key|apikey|secret)\s*[=:]\s*\S+/gi, replacement: "token=[REDACTED:TOKEN]" },
];

export function redact(input: string): RedactionResult {
  let text = input;
  let redactionsApplied = 0;

  for (const pattern of PATTERNS) {
    const matches = text.match(pattern.regex);
    if (matches) {
      redactionsApplied += matches.length;
      text = text.replace(pattern.regex, pattern.replacement);
    }
  }

  // Flag as unusable if too much was redacted (heuristic: redacted text is >50% shorter)
  const lengthRatio = text.length / Math.max(input.length, 1);
  const unusable = redactionsApplied > 0 && lengthRatio < 0.5;

  return { text, redactionsApplied, unusable };
}

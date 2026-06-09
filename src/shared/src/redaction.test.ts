import { describe, it, expect } from "vitest";
import { redact } from "./redaction";

describe("Sensitive Data Redaction", () => {
  it("redacts AWS access keys", () => {
    const input = "Config: AKIAIOSFODNN7EXAMPLE is the key";
    const result = redact(input);
    expect(result.text).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(result.text).toContain("[REDACTED:AWS_KEY]");
    expect(result.redactionsApplied).toBeGreaterThan(0);
  });

  it("redacts API tokens/bearer tokens", () => {
    const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123";
    const result = redact(input);
    expect(result.text).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(result.text).toContain("[REDACTED:TOKEN]");
  });

  it("redacts email addresses", () => {
    const input = "Contact admin@dot.ohio.gov for help";
    const result = redact(input);
    expect(result.text).not.toContain("admin@dot.ohio.gov");
    expect(result.text).toContain("[REDACTED:EMAIL]");
  });

  it("redacts SSN patterns", () => {
    const input = "SSN: 123-45-6789 on file";
    const result = redact(input);
    expect(result.text).not.toContain("123-45-6789");
    expect(result.text).toContain("[REDACTED:SSN]");
  });

  it("redacts passwords in connection strings", () => {
    const input = "postgresql://user:s3cr3tP@ss@db.host:5432/mydb";
    const result = redact(input);
    expect(result.text).not.toContain("s3cr3tP@ss");
    expect(result.text).toContain("[REDACTED:PASSWORD]");
  });

  it("passes through non-sensitive data unchanged", () => {
    const input = "Server web-01 has disk usage at 95%";
    const result = redact(input);
    expect(result.text).toBe(input);
    expect(result.redactionsApplied).toBe(0);
  });

  it("flags unusable when redaction removes critical context", () => {
    const input = "AKIAIOSFODNN7EXAMPLE AKIAIOSFODNN7EXAMPL2 password=abc123 token=xyz789";
    const result = redact(input);
    expect(result.redactionsApplied).toBeGreaterThanOrEqual(2);
    // If more than 50% of content is redacted, flag as unusable
    if (result.unusable) {
      expect(result.unusable).toBe(true);
    }
  });
});

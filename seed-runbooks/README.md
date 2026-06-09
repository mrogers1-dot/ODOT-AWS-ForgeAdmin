# Seed Runbooks

Place your existing runbook documents here before running `scripts/seed-knowledge-base.ts`.

## Expected Format

Each runbook should be a Markdown file with the following structure:

```md
# [Title]

## Applicable Incident Types
- [List incident types this runbook addresses]

## Prerequisites
- [Required access, tools, or conditions]

## Procedure
1. [Step-by-step instructions]
2. [...]

## Expected Outcomes
- [What success looks like]

## Rollback Steps
1. [How to undo if something goes wrong]
```

## What to Include

- AD account management procedures (unlock, enable, password reset)
- Service restart procedures (common services: Print Spooler, DNS Client, etc.)
- Health check remediation steps
- DNS record management procedures
- Any tribal knowledge your team uses daily

## File Naming

Use descriptive names:
- `ad-unlock-account.md`
- `ad-enable-account.md`
- `ad-reset-password.md`
- `service-restart-print-spooler.md`
- `dns-add-a-record.md`
- `health-check-disk-space.md`

The more documents you seed, the better the Research Agent's proposals will be from day one.

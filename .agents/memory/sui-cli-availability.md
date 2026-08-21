---
name: Sui CLI availability
description: Environment-specific constraint for on-chain verification in this project.
---

The imported project notes recorded a Sui CLI and testnet setup, but the active Replit workflow shell did not expose `sui` when verified on August 21, 2026.

**Why:** Move build, publish, object IDs, and transaction digests must come from real CLI output; they must never be inferred from stale setup notes.

**How to apply:** Before any on-chain claim, run `sui --version`, `sui move build`, and the relevant `sui client` command in the active workflow environment. Keep local demo identifiers explicitly prefixed as non-chain values.
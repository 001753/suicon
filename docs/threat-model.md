# Tier D threat model

## Trust boundaries

- The browser is untrusted. Amount, recipient, service, nonce, and policy values from the browser are never authoritative.
- The API prepares and revalidates an intent against the registered service catalog before execution.
- Move is the final enforcement boundary for account status, service recipient, expiry, nonce, per-transaction limit, and daily limit.
- The AI planner is untrusted input processing. Only registered service IDs can produce an allowed decision.

## Known limitations

- This Tier D slice uses a deterministic mock AI provider; no live provider is configured.
- On-chain publish and settlement require a funded Sui testnet wallet. Local demo responses are clearly marked as `local-demo-*` and are not transaction digests.
- `day_bucket = Clock.timestamp_ms() / 86_400_000` is a fixed UTC window, not a rolling 24-hour window. Two transactions approximately one minute apart across UTC midnight can pass separate daily windows. This is an intentional Tier D simplification.
- There is no human approval threshold, sponsored transaction, zkLogin, Walrus artifact, third-party provider SDK, or production-grade rate limiting in Tier D.
- A browser wallet adapter is optional for the simulator; an injected wallet is required for a real transaction.

## Tier D non-goals

This system is not a wallet, trading bot, or new payment rail. It does not claim mainnet safety, economic security, custody protection, or official hackathon submission eligibility.
# Sui Agent Policy Control Plane

## Setup verification

- Sui CLI installed with the official `suiup` installer: `sui 1.78.0-d8459684b41e`
- Sui CLI default channel: `sui@testnet-v1.78.0`
- The CLI binary is available after adding `/home/runner/.local/bin` to `PATH`.
- Current runtime: Node.js `v20.20.0`, npm `10.8.2`
- The intended network is Sui testnet only. Do not claim publish or digest output until a funded wallet is available.
- Active Sui environment: `testnet` (`https://fullnode.testnet.sui.io:443`)
- Active wallet has no gas coins; use the official faucet UI shown by `sui client faucet` before publishing.

## Current scope

Tier D local vertical slice is implemented. It uses a deterministic mock provider and
explicit `local-demo` execution mode because no live AI provider or Sui CLI is configured.
The submission track and deadline have not been confirmed from an official source.

## Wallet safety

The Sui client generated a new testnet wallet during setup. Its recovery phrase must remain private and must never be committed or pasted into chat. The wallet currently has no gas coins.

## Verified commands

- `sui move build --path contracts/agent_commerce` — succeeds with non-blocking composability warnings.
- `sui move test --path contracts/agent_commerce` — 1 test passed.
- `npm test` — 10 tests passed.
# Sui Agent Policy Control Plane

## Setup verification

- Current workflow shell: `sui: command not found`
- Current runtime: Node.js `v20.20.0`, npm `10.8.2`
- The intended network is Sui testnet only. Do not claim publish or digest output until the Sui CLI is installed and a funded wallet is available.

## Current scope

Tier D local vertical slice is implemented. It uses a deterministic mock provider and
explicit `local-demo` execution mode because no live AI provider or Sui CLI is configured.
The submission track and deadline have not been confirmed from an official source.

## Wallet safety

The Sui client generated a new testnet wallet during setup. Its recovery phrase must remain private and must never be committed or pasted into chat. The wallet currently has no gas coins.
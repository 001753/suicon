#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const sui = process.env.SUI_BIN || "sui";
try {
  const gas = execFileSync(sui, ["client", "gas"], { encoding: "utf8" });
  if (/No gas coins/.test(gas)) {
    console.error("No testnet gas coins found. Fund the configured wallet through the official Sui testnet faucet, then rerun this script.");
    process.exit(2);
  }
  console.log(gas);
} catch (error) {
  console.error("Unable to inspect the Sui wallet. Ensure Sui CLI is installed and configured for testnet.");
  process.exit(1);
}
export const appConfig = Object.freeze({
  network: process.env.SUI_NETWORK || "testnet",
  port: Number(process.env.PORT || 5000),
  intentTtlMs: 15 * 60_000,
  explorerBaseUrl: "https://suiexplorer.com/txblock",
  executionMode: process.env.EXECUTION_MODE || "local-demo",
});

export function assertTestnetConfig(config = appConfig) {
  if (config.network !== "testnet") throw new Error("E_NETWORK_MISMATCH");
  if (config.executionMode !== "local-demo" && !config.packageId) {
    throw new Error("Missing configured Move package ID");
  }
}
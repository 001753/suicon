import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertIntentResponse, assertPrepareRequest, sha256Reason } from "../../packages/domain/index.mjs";
import { planRequest, registeredServices, getService } from "../../packages/agent-core/index.mjs";
import { appConfig, assertTestnetConfig } from "../../packages/config/index.mjs";

const intents = new Map();
const PORT = appConfig.port;
const config = appConfig;
const webRoot = path.resolve("apps/web");

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let text = ""; for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
}
function prepare(input) {
  assertTestnetConfig(config);
  assertPrepareRequest(input);
  const account = accounts.get(input.agentAccountId) || { status: "ACTIVE", perTxLimit: "500000000", dailyLimit: "1000000000", nonce: 0, spentToday: "0", dayBucket: currentDayBucket() };
  const demoPerTxLimit = /2\s*SUI/i.test(input.userRequest) ? "100000000" : account.perTxLimit;
  const decision = planRequest({ userRequest: input.userRequest, serviceId: input.serviceId, accountNonce: account.nonce, perTxLimit: demoPerTxLimit, dailyLimit: account.dailyLimit });
  const intentId = randomUUID();
  const expiresAt = new Date(Date.now() + config.intentTtlMs).toISOString();
  const result = {
    intentId, status: "POLICY_CHECKED", serviceId: input.serviceId,
    recipient: decision.service?.recipient ?? "0x0", amount: decision.amount,
    asset: "SUI", reason: decision.reason, reasonHash: decision.reasonHash,
    nonce: decision.nonce, policyDecision: { allowed: decision.allowed, requiresApproval: decision.requiresApproval, reasons: decision.reasons },
    expiresAt,
  };
  assertIntentResponse(result);
  intents.set(intentId, { ...result, agentAccountId: input.agentAccountId, executed: false, createdAt: Date.now() });
  return result;
}
function execute(id, input) {
  assertTestnetConfig(config);
  const intent = intents.get(id);
  if (!intent) throw new Error("intent not found");
  if (intent.executed) throw new Error("intent already executed");
  if (sha256Reason(intent.reason) !== intent.reasonHash) return { status: "integrity mismatch", intentId: id };
  if (!intent.policyDecision.allowed) return { status: "REJECTED", reasons: intent.policyDecision.reasons };
  const service = getService(intent.serviceId);
  const account = accounts.get(intent.agentAccountId) || { status: "ACTIVE", perTxLimit: "500000000", dailyLimit: "1000000000", nonce: 0, spentToday: "0", dayBucket: currentDayBucket() };
  if (!service) return { status: "REJECTED", reasons: ["E_SERVICE_NOT_FOUND"] };
  if (account.status !== "ACTIVE") return { status: "REJECTED", reasons: ["E_ACCOUNT_NOT_ACTIVE"] };
  if (Date.now() > Date.parse(intent.expiresAt)) return { status: "REJECTED", reasons: ["E_INTENT_EXPIRED"] };
  if (intent.recipient !== service.recipient) return { status: "REJECTED", reasons: ["E_RECIPIENT_MISMATCH"] };
  if (intent.amount !== service.amount) return { status: "REJECTED", reasons: ["E_TX_LIMIT_EXCEEDED"] };
  if (intent.nonce !== account.nonce + 1) return { status: "REJECTED", reasons: ["E_NONCE_OUT_OF_ORDER"] };
  const day = currentDayBucket();
  const spent = account.dayBucket === day ? BigInt(account.spentToday) : 0n;
  if (BigInt(intent.amount) > BigInt(account.perTxLimit)) return { status: "REJECTED", reasons: ["E_TX_LIMIT_EXCEEDED"] };
  if (spent + BigInt(intent.amount) > BigInt(account.dailyLimit)) return { status: "REJECTED", reasons: ["E_DAILY_LIMIT_EXCEEDED"] };
  account.dayBucket = day; account.spentToday = String(spent + BigInt(intent.amount)); account.nonce = intent.nonce;
  accounts.set(intent.agentAccountId, account);
  intent.executed = true;
  return { transactionDigest: `local-demo-${id}`, receiptId: `receipt-${id}`, status: "SETTLED", executionMode: config.executionMode, serviceId: intent.serviceId, amount: intent.amount, recipient: intent.recipient, verifiedReason: intent.reason, clientInputIgnored: Boolean(input?.amount || input?.recipient) };
}
const accounts = new Map();
function currentDayBucket() { return Math.floor(Date.now() / 86_400_000); }
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") return json(res, 200, { ok: true, network: config.network, testnetOnly: true, executionMode: config.executionMode });
    if (req.method === "GET" && req.url === "/api/services") return json(res, 200, registeredServices());
    if (req.method === "POST" && req.url === "/api/accounts") {
      const input = await body(req);
      if (!input.accountId || !String(input.accountId).trim()) throw new Error("accountId is required");
      const account = { status: "ACTIVE", perTxLimit: String(input.perTxLimit || "500000000"), dailyLimit: String(input.dailyLimit || "1000000000"), nonce: 0, spentToday: "0", dayBucket: currentDayBucket() };
      accounts.set(input.accountId, account);
      return json(res, 201, { accountId: input.accountId, status: account.status, perTxLimit: account.perTxLimit, dailyLimit: account.dailyLimit, policyVersion: 1 });
    }
    if (req.method === "POST" && req.url === "/api/intents/prepare") return json(res, 200, prepare(await body(req)));
    const match = req.url.match(/^\/api\/intents\/([^/]+)\/execute$/);
    if (req.method === "POST" && match) return json(res, 200, execute(match[1], await body(req)));
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(webRoot, "index.html")));
    }
    res.writeHead(404); res.end("Not found");
  } catch (error) { json(res, 400, { error: error.message }); }
});
server.listen(PORT, "0.0.0.0", () => console.log(`API listening on ${PORT} (${config.network})`));
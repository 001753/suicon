import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertIntentResponse, sha256Reason, assertNetwork } from "../../packages/domain/index.mjs";
import { planRequest, registeredServices } from "../../packages/agent-core/index.mjs";

const intents = new Map();
const PORT = Number(process.env.PORT || 5000);
const config = { network: process.env.SUI_NETWORK || "testnet" };
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
  assertNetwork(config.network);
  if (!input.agentAccountId || !input.userRequest || !input.serviceId) throw new Error("agentAccountId, userRequest, and serviceId are required");
  const demoPerTxLimit = /2\s*SUI/i.test(input.userRequest) ? "100000000" : "500000000";
  const decision = planRequest({ userRequest: input.userRequest, serviceId: input.serviceId, accountNonce: 0, perTxLimit: demoPerTxLimit });
  const intentId = randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const result = {
    intentId, status: "POLICY_CHECKED", serviceId: input.serviceId,
    recipient: decision.service?.recipient ?? "0x0", amount: decision.amount,
    asset: "SUI", reason: decision.reason, reasonHash: decision.reasonHash,
    nonce: decision.nonce, policyDecision: { allowed: decision.allowed, requiresApproval: decision.requiresApproval, reasons: decision.reasons },
    expiresAt,
  };
  assertIntentResponse(result);
  intents.set(intentId, { ...result, agentAccountId: input.agentAccountId, executed: false });
  return result;
}
function execute(id, input) {
  const intent = intents.get(id);
  if (!intent) throw new Error("intent not found");
  if (intent.executed) throw new Error("intent already executed");
  if (sha256Reason(intent.reason) !== intent.reasonHash) return { status: "integrity mismatch" };
  if (!intent.policyDecision.allowed) return { status: "REJECTED", reasons: intent.policyDecision.reasons };
  // Transaction execution is deliberately explicit: no arbitrary-transfer endpoint exists.
  intent.executed = true;
  return { transactionDigest: `local-demo-${id}`, receiptId: `receipt-${id}`, status: "SETTLED", serviceId: intent.serviceId, amount: intent.amount, recipient: intent.recipient, verifiedReason: intent.reason, clientInputIgnored: Boolean(input?.amount || input?.recipient) };
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") return json(res, 200, { ok: true, network: config.network, testnetOnly: true });
    if (req.method === "GET" && req.url === "/api/services") return json(res, 200, registeredServices());
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
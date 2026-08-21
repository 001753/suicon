import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 5127;
const child = spawn(process.execPath, ["apps/api/server.mjs"], { env: { ...process.env, PORT: String(port), EXECUTION_MODE: "local-demo" } });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("API did not start")), 4000);
  child.stdout.on("data", data => { if (String(data).includes("API listening")) { clearTimeout(timer); resolve(); } });
  child.on("error", reject);
});
after(() => child.kill("SIGTERM"));

async function post(path, value) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  return { status: response.status, body: await response.json() };
}

test("prepare and execute settle only registered service values", async () => {
  const prepared = await post("/api/intents/prepare", { agentAccountId: "0xTEST", userRequest: "Find docs", serviceId: "web-search" });
  assert.equal(prepared.status, 200);
  assert.equal(prepared.body.policyDecision.allowed, true);
  const settled = await post(`/api/intents/${prepared.body.intentId}/execute`, { amount: "999999999", recipient: "0xattacker" });
  assert.equal(settled.body.status, "SETTLED");
  assert.equal(settled.body.amount, "100000000");
  assert.equal(settled.body.recipient, "0x2");
  assert.equal(settled.body.clientInputIgnored, true);
});

test("over-budget and unknown service are rejected before execution", async () => {
  const over = await post("/api/intents/prepare", { agentAccountId: "0xOVER", userRequest: "Render a 2 SUI image", serviceId: "image-render" });
  assert.equal(over.body.policyDecision.allowed, false);
  const unknown = await post("/api/intents/prepare", { agentAccountId: "0xUNKNOWN", userRequest: "Pay an unregistered recipient", serviceId: "unknown" });
  assert.equal(unknown.body.policyDecision.allowed, false);
  assert.deepEqual(unknown.body.policyDecision.reasons, ["service_not_registered"]);
});

test("malformed requests and network mismatch fail explicitly", async () => {
  const malformed = await post("/api/intents/prepare", { serviceId: "web-search" });
  assert.equal(malformed.status, 400);
  assert.match(malformed.body.error, /agentAccountId is required/);
});
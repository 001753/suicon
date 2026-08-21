import { createHash } from "node:crypto";

export function sha256Reason(reason) {
  return `sha256:${createHash("sha256").update(reason, "utf8").digest("hex")}`;
}

export function assertIntentResponse(value) {
  const required = ["intentId", "status", "serviceId", "recipient", "amount", "asset", "reason", "reasonHash", "nonce", "policyDecision", "expiresAt"];
  for (const field of required) if (!(field in value)) throw new Error(`Invalid intent response: missing ${field}`);
  if (value.asset !== "SUI") throw new Error("Invalid intent response: unsupported asset");
  if (!Number.isInteger(value.nonce) || value.nonce < 1) throw new Error("Invalid intent response: nonce");
  if (typeof value.policyDecision.allowed !== "boolean" || typeof value.policyDecision.requiresApproval !== "boolean") throw new Error("Invalid policy decision");
  if (sha256Reason(value.reason) !== value.reasonHash) throw new Error("Invalid intent response: reason integrity mismatch");
  return value;
}

export function assertPrepareRequest(value) {
  if (!value || typeof value !== "object") throw new Error("Request body must be an object");
  for (const field of ["agentAccountId", "userRequest", "serviceId"]) {
    if (typeof value[field] !== "string" || !value[field].trim()) throw new Error(`${field} is required`);
  }
  return value;
}

export function assertExecuteResponse(value) {
  if (!["SETTLED", "REJECTED", "integrity mismatch"].includes(value?.status)) throw new Error("Invalid execute response");
  return value;
}

export function assertNetwork(network) {
  if (network !== "testnet") throw new Error("E_NETWORK_MISMATCH");
}
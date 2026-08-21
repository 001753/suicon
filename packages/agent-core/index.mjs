import { sha256Reason } from "../domain/index.mjs";

const SERVICES = new Map([
  ["web-search", { serviceId: "web-search", recipient: "0x2", amount: "100000000", asset: "SUI" }],
  ["image-render", { serviceId: "image-render", recipient: "0x3", amount: "200000000", asset: "SUI" }],
]);

export function registeredServices() { return [...SERVICES.values()]; }

export function planRequest({ userRequest, serviceId, accountNonce = 0, perTxLimit = "500000000", dailyLimit = "1000000000" }) {
  const service = SERVICES.get(serviceId);
  const hostileRecipient = /recipient|send|transfer|pay to|0x[a-f0-9]+/i.test(userRequest) && !service;
  const reason = service ? `Use registered ${service.serviceId} for: ${userRequest}` : `No registered service matches: ${userRequest}`;
  const amount = service?.amount ?? "0";
  const allowed = Boolean(service) && !hostileRecipient && BigInt(amount) <= BigInt(perTxLimit) && BigInt(amount) + 0n <= BigInt(dailyLimit);
  return {
    service, reason, reasonHash: sha256Reason(reason), amount,
    allowed, requiresApproval: false,
    reasons: service ? (allowed ? ["service_registered", "within_per_tx_limit", "within_daily_limit"] : ["policy_limit_exceeded"]) : ["service_not_registered"],
    nonce: accountNonce + 1,
  };
}
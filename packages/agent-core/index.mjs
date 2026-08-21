import { sha256Reason } from "../domain/index.mjs";

const SERVICES = new Map([
  ["web-search", { serviceId: "web-search", recipient: "0x2", amount: "100000000", asset: "SUI" }],
  ["image-render", { serviceId: "image-render", recipient: "0x3", amount: "200000000", asset: "SUI" }],
]);

export function registeredServices() { return [...SERVICES.values()]; }
export function getService(serviceId) { return SERVICES.get(serviceId); }

export function planRequest({ userRequest, serviceId, accountNonce = 0, perTxLimit = "500000000", dailyLimit = "1000000000" }) {
  const service = SERVICES.get(serviceId);
  const hostileRecipient = /recipient|send|transfer|pay to|0x[a-f0-9]+/i.test(userRequest) && !service;
  const reason = service ? `Use registered ${service.serviceId} for: ${userRequest}` : `No registered service matches: ${userRequest}`;
  const amount = service?.amount ?? "0";
  const overTx = Boolean(service) && BigInt(amount) > BigInt(perTxLimit);
  const overDaily = Boolean(service) && BigInt(amount) > BigInt(dailyLimit);
  const allowed = Boolean(service) && !hostileRecipient && !overTx && !overDaily;
  const reasons = !service ? ["service_not_registered"] :
    hostileRecipient ? ["recipient_not_from_registered_service"] :
    overTx ? ["policy_limit_exceeded", "per_tx_limit_exceeded"] :
    overDaily ? ["policy_limit_exceeded", "daily_limit_exceeded"] :
    ["service_registered", "within_per_tx_limit", "within_daily_limit"];
  return {
    service, reason, reasonHash: sha256Reason(reason), amount,
    allowed, requiresApproval: false, reasons,
    nonce: accountNonce + 1,
  };
}
/** Server delivery policy; intentionally not connected to the public form. */
export type InquiryDeliveryConfig = {
  mode: "off" | "webhook";
  recipient: string;
  domainVerified: boolean;
  mailboxVerified: boolean;
  deliveryVerified: boolean;
  endpoint: string;
  token: string;
};
export type PreparedInquiry = { replyTo: string; brief: string };
export type InquiryDeliveryResult = { status: "disabled" | "unverified" | "invalid" | "failed" } | { status: "accepted" };

export async function deliverPreparedInquiry(config: InquiryDeliveryConfig, inquiry: PreparedInquiry, transport: typeof fetch): Promise<InquiryDeliveryResult> {
  if (config.mode === "off") return { status: "disabled" };
  if (!config.domainVerified || !config.mailboxVerified || !config.deliveryVerified) return { status: "unverified" };
  let endpoint: URL;
  try { endpoint = new URL(config.endpoint); } catch { return { status: "invalid" }; }
  const email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash || !config.token.trim()
    || !email.test(config.recipient) || !email.test(inquiry.replyTo) || !inquiry.brief.trim() || inquiry.brief.length > 12_000) return { status: "invalid" };
  try {
    const response = await transport(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ to: config.recipient, replyTo: inquiry.replyTo, subject: "Madagin project brief", text: inquiry.brief }),
    });
    // Provider acceptance is not a claim that a recipient received the message.
    return { status: response.ok ? "accepted" : "failed" };
  } catch { return { status: "failed" }; }
}

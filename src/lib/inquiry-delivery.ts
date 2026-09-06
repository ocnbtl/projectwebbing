import "server-only";
import { deliverPreparedInquiry, type PreparedInquiry } from "./inquiry-delivery-policy";

export function deliverInquiry(inquiry: PreparedInquiry) {
  return deliverPreparedInquiry({
    mode: process.env.MADAGIN_INQUIRY_DELIVERY === "webhook" ? "webhook" : "off",
    recipient: process.env.MADAGIN_INQUIRY_RECIPIENT ?? "contact@madagin.com",
    domainVerified: process.env.MADAGIN_INQUIRY_DOMAIN_VERIFIED === "true",
    mailboxVerified: process.env.MADAGIN_INQUIRY_MAILBOX_VERIFIED === "true",
    deliveryVerified: process.env.MADAGIN_INQUIRY_DELIVERY_VERIFIED === "true",
    endpoint: process.env.MADAGIN_INQUIRY_ENDPOINT ?? "",
    token: process.env.MADAGIN_INQUIRY_TOKEN ?? "",
  }, inquiry, fetch);
}

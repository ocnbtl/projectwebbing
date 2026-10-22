"use server";

import { deliverInquiry } from "@/lib/inquiry-delivery";
import { inquiryBrief, validInquiry } from "@/lib/inquiry-form";
import type { InquiryDeliveryResult } from "@/lib/inquiry-delivery-policy";
import {headers} from 'next/headers';
import {allowInquiryAttempt} from '@/lib/inquiry-rate-limit';

export async function submitInquiry(input:unknown):Promise<InquiryDeliveryResult> {
  if (!validInquiry(input)) return { status:"invalid" };
  if('contactCheck' in input&&input.contactCheck)return {status:'invalid'};
  // Local development and preview rehearsals never send email.
  if (process.env.VERCEL_ENV !== "production") return { status:"disabled" };
  const requestHeaders=await headers();
  const ip=requestHeaders.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()??'unknown';
  if(!allowInquiryAttempt(ip,input.email))return {status:'limited'};
  return deliverInquiry({ replyTo:input.email.trim(), brief:inquiryBrief(input) });
}

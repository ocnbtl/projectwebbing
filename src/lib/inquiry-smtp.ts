import type { InquiryDeliveryResult, PreparedInquiry } from './inquiry-delivery-policy';
import type { SendMailOptions } from 'nodemailer';

export type InquirySmtpConfig = { host:string; port:number; user:string; password:string; recipient:string };
const email=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export function validSmtpConfig(config:InquirySmtpConfig){
 return /^(smtp|smtppro)\.zoho\.(com|eu|in|com\.au|jp|com\.cn|ca|sa)$/.test(config.host)
  && [465,587].includes(config.port) && email.test(config.user) && email.test(config.recipient) && !!config.password.trim();
}
export async function deliverSmtpInquiry(config:InquirySmtpConfig,inquiry:PreparedInquiry,send:(message:SendMailOptions)=>Promise<{accepted:unknown[];rejected:unknown[]}>):Promise<InquiryDeliveryResult>{
 if(!validSmtpConfig(config))return {status:'unverified'};
 if(!email.test(inquiry.replyTo)||!inquiry.brief.trim()||inquiry.brief.length>12000)return {status:'invalid'};
 try{
  const result=await send({from:{name:'Madagin inquiries',address:config.user},to:config.recipient,
   replyTo:inquiry.replyTo,subject:'New project inquiry · Madagin',text:inquiry.brief,
   disableFileAccess:true,disableUrlAccess:true});
  // Only the fixed studio recipient is sent mail. A visitor is never an envelope recipient.
  const accepted=result.accepted.some(address=>typeof address==='string'&&address.toLowerCase()===config.recipient.toLowerCase());
  return {status:accepted&&!result.rejected.length?'accepted':'failed'};
 }catch{return {status:'failed'};}
}

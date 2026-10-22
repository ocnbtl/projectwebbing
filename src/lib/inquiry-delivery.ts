import "server-only";
import { deliverPreparedInquiry, type PreparedInquiry } from "./inquiry-delivery-policy";
import {deliverSmtpInquiry,validSmtpConfig} from './inquiry-smtp';

export async function deliverInquiry(inquiry: PreparedInquiry) {
  if(process.env.MADAGIN_INQUIRY_DELIVERY==='smtp'){
    const config={host:process.env.MADAGIN_SMTP_HOST??'',port:Number(process.env.MADAGIN_SMTP_PORT??465),
      user:process.env.MADAGIN_SMTP_USER??'ocean@madagin.com',password:process.env.MADAGIN_SMTP_PASSWORD??'',
      recipient:process.env.MADAGIN_INQUIRY_RECIPIENT??'contact@madagin.com'};
    if(!validSmtpConfig(config))return {status:'unverified'} as const;
    const {default:nodemailer}=await import('nodemailer');
    const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.port===465,requireTLS:true,
      auth:{user:config.user,pass:config.password},tls:{minVersion:'TLSv1.2'},
      connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
      disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
    try{return await deliverSmtpInquiry(config,inquiry,message=>transport.sendMail(message));}
    finally{transport.close();}
  }
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

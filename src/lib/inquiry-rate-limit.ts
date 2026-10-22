import {createHash} from 'node:crypto';

const attempts=new Map<string,{count:number;expires:number}>();
/** Bounded per-instance backstop; provider limits still apply across instances. */
export function allowInquiryAttempt(ip:string,email:string,now=Date.now()){
 for(const [key,bucket] of attempts)if(bucket.expires<=now)attempts.delete(key);
 const keys=[['ip',ip,5],['email',email.trim().toLowerCase(),3]] as const;
 const buckets=keys.map(([kind,value,limit])=>({key:createHash('sha256').update(`${kind}:${value}`).digest('hex'),limit}));
 if(attempts.size>2000||buckets.some(({key,limit})=>(attempts.get(key)?.count??0)>=limit))return false;
 for(const {key} of buckets){const bucket=attempts.get(key)??{count:0,expires:now+600000};bucket.count++;attempts.set(key,bucket);}
 return true;
}

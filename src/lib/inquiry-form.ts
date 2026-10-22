import { budgetOptions, timingOptions } from "./inquiry-options";

export const projectOptions = ["Create a website", "Shape a brand", "Improve a website", "Build smarter systems", "Find the right direction", "Something else"];
export const projectDescriptions:Record<string,string>={
 "Create a website":"A new site or a complete redesign",
 "Shape a brand":"Your identity, positioning, and voice",
 "Create content":"Words, photography, and film",
 "Improve a website":"SEO, AEO, usability, speed, and ongoing care",
 "Build smarter systems":"Connected tools and less manual work",
 "Find the right direction":"Clear priorities and practical next steps",
};
// These are areas to discuss, not a guessed specification or a fixed package.
export const projectServices:Record<string,string[]>={
 "Create a website":["Website design or development"],"Shape a brand":["Brand identity"],
 "Create content":["Copywriting, photography or video"],"Improve what we have":["SEO, usability or performance"],
 "Connect our tools":["Integrations or automation"],"Keep things running":["Ongoing support & updates"],
 "Find the right direction":["Strategy & advice"],"Something else":["Something else"],
 "Improve a website":["SEO, usability or performance","Answer engine optimization (AEO)","Ongoing support & updates"],
 "Build smarter systems":["Integrations or automation","Ongoing support & updates"],
};
export const goalOptions = ["Win more leads", "Increase sales", "Modernize our brand", "Grow our audience", "Get found online", "Build more trust", "Launch a new offer", "Reduce admin work", "Cut software costs", "Connect our tools", "Not sure yet", "Something else"];
const legacyProjects=["Create content","Starting something new", "Outgrowing our website", "Changing our direction", "Exploring an idea", "Improve what we have", "Connect our tools", "Keep things running"];
const legacyGoals=["Fill our calendar","Generate more leads", "Convert more visitors", "Get found in search", "Spend less on software", "Connect our systems","Reach more people", "Win more business", "Clarify our message", "Improve the experience", "Save time", "Keep things running smoothly","Attract more inquiries", "Increase online sales", "Clarify the brand message", "Help customers find answers", "Launch a new offering", "Reduce manual admin"];
export const serviceOptions = ["Website strategy", "Brand identity", "Website design", "Website development", "Website copywriting", "Photography & video", "Search visibility (SEO)", "Not sure yet",...new Set(Object.values(projectServices).flat())];
export type InquiryAnswers = { stage:string[]; aim:string[]; other:string; otherService?:string; needs:string[]; timing:string; budget:string; name:string; email:string; context:string };

export function validInquiry(value: unknown): value is InquiryAnswers {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  const text = (key:string, max:number, required=true) => typeof a[key] === "string" && (a[key] as string).length <= max && (!required || !!(a[key] as string).trim());
  const choices = (key:string, allowed:readonly string[]) => Array.isArray(a[key]) && a[key].length > 0 && a[key].length <= allowed.length && a[key].every(v => typeof v === "string" && allowed.includes(v));
  return choices("stage", [...projectOptions,...legacyProjects]) && choices("aim", [...goalOptions,...legacyGoals]) && choices("needs", serviceOptions)
    && text("other", 500, false) && (a.otherService===undefined||text("otherService",500,false)) && text("name", 120) && text("email", 254) && text("context", 3000)
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(a.email as string)
    && [...budgetOptions, "Not sure yet"].includes(a.budget as typeof budgetOptions[number])
    && (a.timing === "" || timingOptions.includes(a.timing as typeof timingOptions[number]));
}

export function inquiryBrief(a:InquiryAnswers, saved=false) {
  return ["MADAGIN / PROJECT INQUIRY", ...(saved ? ["This saved copy has not been sent."] : []), "", ...Object.entries({Project:a.stage.join(", "), "Other request":a.stage.includes("Something else")?a.otherService??"":"", Goals:a.aim.join(", "), "Other goal":a.aim.includes("Something else")?a.other:"", "Areas to discuss":a.needs.join(", "), "Budget (USD)":a.budget, ...(a.timing?{Timeline:a.timing}:{}), Name:a.name.trim(), Email:a.email.trim(), Details:a.context.trim()}).flatMap(([key,value])=>[key,value,""])].join("\n");
}

import { createElement, type SVGProps } from "react";
import icons from "./tabler-icons.json";

// Tabler Icons, MIT. License and pinned SVG sources: /media/tabler/.
export type TablerIconName = keyof typeof icons;
type IconNode = [string, Record<string, string>];

export function TablerGlyph({name,pathClasses,animated=false}:{name:TablerIconName;pathClasses?:string[];animated?:boolean}) {
  return (icons[name] as IconNode[]).map(([tag,attributes],index)=>createElement(tag,{
    ...attributes,key:index,className:pathClasses?.[index],...(animated?{pathLength:1,vectorEffect:"non-scaling-stroke"}:{}),
  }));
}

export function TablerIcon({name,size=24,...props}:Omit<SVGProps<SVGSVGElement>,"name">&{name:TablerIconName;size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-icon={name} {...props}><TablerGlyph name={name}/></svg>;
}

import type { CSSProperties } from "react";
import { aliceSpacing } from "./brand-wordmark-spacing";

/** The same optical pairs are used by the DOM, SVG study and glass renderer. */
export function BrandWordmark({ className = "" }: { className?: string }) {
 return <span className={`brand-wordmark ${className}`} role="img" aria-label="Madagin" data-brand-wordmark="Alice">
  {Array.from("MADAGIN").map((letter, index) => <span aria-hidden="true" key={index} style={{ marginInlineEnd: `${aliceSpacing[index]}em`, "--letter": index } as CSSProperties}>{letter}</span>)}
 </span>;
}

export function BrandName() { return <span className="brand-name">Madagin</span>; }

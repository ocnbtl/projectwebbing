"use client";

import { useId, useState, type CSSProperties } from "react";
import { budgetOptions } from "@/lib/inquiry-options";
import { TablerIcon } from "@/components/ui/tabler-icon";
import styles from "./budget-scale.module.css";

const ranges = budgetOptions.slice(0, -1);
const undecided = budgetOptions[budgetOptions.length - 1];
const rangeKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

export function BudgetScale({ value, onChange, labelledBy }: {
  value: string; onChange: (value: string) => void; labelledBy: string;
}) {
  const id = useId();
  const [dragPosition,setDragPosition]=useState<number|null>(null);
  const selected = ranges.findIndex(range => range === value);
  const index = Math.max(0, selected);
  const unsure = value === undecided;
  const select = (next: string) => onChange(ranges[Math.max(0,Math.min(ranges.length-1,Math.round(Number(next))))]);
  const position=dragPosition??index;
  return <div className={styles.budget} data-selected={selected >= 0}>
    <div className={styles.readout}>
      <output htmlFor={`${id}-range`} aria-live="off">{selected >= 0 ? value : unsure ? "Not sure yet" : "Choose a range"}</output>
      <span>{selected >= 0 ? "USD · project investment range" : unsure ? "We can work out the right scope together." : "USD · choose the range that fits your plans"}</span>
    </div>
    <div className={styles.scale} data-dragging={dragPosition!==null} style={{ "--budget-progress": `${position / (ranges.length - 1) * 100}%` } as CSSProperties}>
      <div className={styles.rail} aria-hidden="true"><i />{ranges.map((range, i) => <b key={range} style={{ left: `${i / (ranges.length - 1) * 100}%` }} />)}</div>
      <input id={`${id}-range`} type="range" min={0} max={ranges.length - 1} step={0.01} value={position}
        aria-labelledby={labelledBy} aria-describedby={`${id}-hint`}
        aria-valuetext={selected >= 0 ? value : unsure ? "Not sure yet. Use arrow keys to choose a budget range." : "No budget selected. Use arrow keys to choose a range."}
        onChange={event => {setDragPosition(Number(event.currentTarget.value));select(event.currentTarget.value);}}
        onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);setDragPosition(index);}}
        onPointerUp={event => {select(event.currentTarget.value);setDragPosition(null);}}
        onPointerCancel={()=>setDragPosition(null)}
        onBlur={()=>setDragPosition(null)}
        onKeyDown={event=>{if(rangeKeys.has(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?ranges.length-1:index+(["ArrowRight","ArrowUp","PageUp"].includes(event.key)?1:-1);setDragPosition(null);select(String(next));}}} />
      <div className={styles.rangeLabels}>{ranges.map((range,i)=><button type="button" key={range} aria-pressed={selected===i} onClick={()=>{setDragPosition(null);onChange(range);}}>{range}</button>)}</div>
    </div>
    <p id={`${id}-hint`} className={styles.hint}>Use arrow keys to select a budget range. Home selects the lowest range and End the highest.</p>
    <button type="button" className={styles.unsure} aria-pressed={unsure} onClick={() => onChange(undecided)}>
      <TablerIcon name={unsure ? "check" : "help-circle"} size={18} />Not sure yet
    </button>
  </div>;
}

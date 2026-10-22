"use client";
import styles from "./strategy-phrase.module.css";
export function StrategyPhrase({className,active=true}:{className:string;active?:boolean}){
 return <h2 id="strategy-title" tabIndex={-1} className={className+' '+styles.heading} data-active={active}>
  <span className={styles.line} data-sequence-end="true">Strategy that ties everything back together and gives your brand a clear next step</span>
 </h2>;
}

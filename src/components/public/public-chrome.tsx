import Link from "next/link";
import {NavigationSession} from "./navigation-session";
import {NavClarity} from "./nav-clarity";
import {NavMark} from "./nav-mark";
import {HomeMarkLink} from "./home-mark-link";
import {FooterMotion} from "./footer-motion";
import {FooterWordmark} from "./footer-wordmark";
import {FooterMotto} from "./footer-motto";

import {MorphText} from "./morph-text";
import {LiquidControl} from "./liquid-control";
import {BrandWordmark} from "./brand-wordmark";
import styles from "./public-chrome.module.css";
const navigation=[{href:"/projects",label:"Work"},{href:"/about",label:"About"}] as const;
export function MadaginMark({compact=false}:{compact?:boolean}) {return <BrandWordmark className={compact?styles.markCompact:styles.mark}/>;}
export function PublicHeader({tone="light",onDestination,activeDestination,home=false,navigationVisible=true,ctaVisible=true,onInquiry,onHome}:{tone?:"dark"|"light";onDestination?:(destination:"about"|"projects"|"blog")=>void;activeDestination?:"about"|"projects"|"blog";home?:boolean;navigationVisible?:boolean;ctaVisible?:boolean;onInquiry?:(keyboard:boolean)=>void;onHome?:(keyboard:boolean)=>void}) {
 return <NavigationSession visible={navigationVisible}><NavClarity><header className={styles.header} data-tone={tone} data-home={home} data-navigation-visible={navigationVisible} data-cta-visible={ctaVisible}><HomeMarkLink onHome={onHome}>{navigationVisible?<NavMark/>:null}</HomeMarkLink><nav className={styles.navigation} aria-label="Primary navigation" inert={!navigationVisible}>{navigation.map(item=><Link data-nav-item="" aria-label={item.label} href={item.href} key={item.href} aria-current={activeDestination===item.href.slice(1)?"page":undefined} onClick={onDestination?event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onDestination(item.href.slice(1) as "about"|"projects");}:undefined}><MorphText word={item.label}/></Link>)}<Link data-nav-item="" aria-label="Inquire" href={home?"#inquiry":"/#inquiry"} onClick={onInquiry?event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onInquiry(event.detail===0);}:undefined}><MorphText word="Inquire"/></Link></nav></header></NavClarity></NavigationSession>;
}
export function PublicFooter({compact=false,onReturn}:{compact?:boolean;onReturn?:(keyboard:boolean)=>void}) {
 return <FooterMotion className={styles.footer} compact={compact}><div className={styles.footerTop}><nav className={styles.navigation} aria-label="Footer navigation">{navigation.map(item=><Link href={item.href} key={item.href}><MorphText word={item.label}/></Link>)}</nav><LiquidControl href="#top" label="Return to top" variant="up" onAction={onReturn}/></div><Link href="/" className={styles.signature} aria-label="Madagin home"><FooterWordmark/></Link><div className={styles.footerBase}><span className={styles.copyright}>© {new Date().getFullYear()} Madagin</span><FooterMotto/></div></FooterMotion>;
}

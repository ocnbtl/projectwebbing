import Link from "next/link";
import styles from "./public-chrome.module.css";
const navigation=[{href:"/projects",label:"Work"},{href:"/about",label:"About"}] as const;
export function MadaginMark({compact=false}:{compact?:boolean}) { return <span className={compact ? styles.markCompact : styles.mark} aria-hidden="true">madagin</span>; }
export function PublicHeader({tone="light",onDestination,activeDestination}:{tone?:"dark"|"light";onDestination?:(destination:"about"|"projects"|"blog")=>void;activeDestination?:"about"|"projects"|"blog"}) {
return <header className={styles.header} data-tone={tone}>
<Link className={styles.logoLink} href="/" aria-label="Madagin home"><MadaginMark/></Link>
<nav className={styles.navigation} aria-label="Primary navigation">{navigation.map(item=><Link href={item.href} key={item.href} aria-current={activeDestination===item.href.slice(1) ? "page" : undefined} onClick={onDestination ? event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();onDestination(item.href.slice(1) as "about"|"projects");}:undefined}><span>{item.label}</span><em aria-hidden="true">{item.label}</em></Link>)}</nav>
<Link className={styles.talkLink} href="/contact"><span>Bring an idea</span><span className={styles.droplet} aria-hidden="true">↗</span></Link>
</header>;
}
export function PublicFooter() {
return <footer className={styles.footer}>
<div className={styles.invitation}><div><span>Good things start somewhere.</span><h2>Have a thought?<br/><em>Give it form.</em></h2></div><Link href="/contact" className={styles.footerCta}>Bring an idea <span aria-hidden="true">↗</span></Link></div>
<div className={styles.footerGrid}><p>A founder-led studio.<br/>Strategy, design, and development.<br/>One considered whole.</p><nav aria-label="Footer navigation"><Link href="/projects">Work</Link><Link href="/about">About</Link><Link href="/blog">Journal</Link></nav><a href="#top" className={styles.backTop}>Back to the surface <span aria-hidden="true">↑</span></a></div>
<Link href="/" className={styles.signature} aria-label="Madagin home">madagin</Link>
<div className={styles.footerBase}><span>Made with intention.</span><span>© {new Date().getFullYear()} Madagin</span></div>
</footer>;
}

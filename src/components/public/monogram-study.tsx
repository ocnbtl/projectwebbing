"use client";
import Link from 'next/link';
import {useRef,useState} from 'react';
import catalog from './monogram-glyphs.json';
import {GlassMonogram} from './glass-monogram';
import {monogramFamilies,saveMonogramFonts,useMonogramFonts} from './monogram-preferences';
import styles from './monogram-study.module.css';
const categories=['All styles','Script','Serif','Display','Sans','Enabled','New'] as const;
export function MonogramStudy(){
 const enabled=useMonogramFonts(),[message,setMessage]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState<string>('All styles'),[preview,setPreview]=useState('Alice'),[current,setCurrent]=useState('Alice'),large=useRef<HTMLDivElement>(null);
 const faces=catalog.M.versions.filter(face=>(category==='All styles'||category==='New'&&face.added||category==='Enabled'&&enabled.includes(face.family)||category===face.category)&&face.family.toLowerCase().includes(query.trim().toLowerCase()));
 function save(names:string[],notice:string){try{saveMonogramFonts(names);setMessage(notice);}catch{setMessage('Your browser could not save this selection.');}}
 function toggle(name:string){const next=enabled.includes(name)?enabled.filter(n=>n!==name):[...enabled,name];if(!next.length){setMessage('Keep at least one font in the cycle.');return;}save(next,'Saved for this browser.');}
 function view(name:string){setPreview(name);large.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
 return <main className={styles.study}><Link href="/wordmark-study">← Wordmark study</Link>
  <header><div><h1>One letter.<br/>119 possibilities.</h1><p>Flowing scripts, expressive serifs, sculptural shapes. Choose the M’s you want to see in the navigation, watch the large letter move through your selection.</p><small>Your existing choices are preserved. Selections apply to this browser; copy them when you’re ready to set the studio’s default.</small></div><div ref={large} className={styles.specimen}><button className={styles.preview} type="button" aria-label="Play your selected monogram fonts" onClick={()=>setMessage('Your selected fonts play automatically.')}><GlassMonogram face={preview} onFontChange={setCurrent}/></button><div><span>{current}</span><small>Your cycle plays automatically</small></div></div></header>
  <div className={styles.controls}>
   <label className={styles.search}><span>Find a font</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search by name"/></label>
   <div className={styles.filters} role="group" aria-label="Font styles">{categories.map(name=><button type="button" key={name} aria-pressed={category===name} onClick={()=>setCategory(name)}>{name}</button>)}</div>
  </div>
  <div className={styles.tools}><span role="status">{faces.length} shown · {enabled.length} enabled</span><button type="button" onClick={()=>save(monogramFamilies,'All 119 fonts enabled.')}>Enable all</button><button type="button" onClick={()=>save(['Alice'],'Alice only. Add your favorites below.')}>Alice only</button><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(enabled.join('\n'));setMessage('Selection copied.');}catch{setMessage('Copy unavailable. Your choices are still saved here.');}}}>Copy selection</button></div>
  <div id="font-choices" className={styles.grid}>{faces.map(face=><article key={face.family} data-font-choice={face.family} data-enabled={enabled.includes(face.family)}>
   <button type="button" className={styles.sample} aria-label={`Preview ${face.family}`} onClick={()=>view(face.family)}><GlassMonogram face={face.family} cycle={false}/><span className={styles.view}>View large ↗</span></button>
   <div className={styles.caption}><span>{face.family}<small>{face.category}{face.added?' · New':''}</small></span><button type="button" aria-label={`Enable ${face.family}`} aria-pressed={enabled.includes(face.family)} onClick={()=>toggle(face.family)}><span aria-hidden="true"/>{enabled.includes(face.family)?'Enabled':'Add'}</button></div>
  </article>)}</div>
  {!faces.length?<p className={styles.empty}>No matching fonts. Try another name or style.</p>:null}
  <p className={styles.notice} role="status">{message}</p><footer>Alice remains the studio wordmark. Each glass preview uses the original letter outline, including its curves and open spaces.</footer>
 </main>;
}

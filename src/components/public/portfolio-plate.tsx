"use client";
import {AnimatePresence,motion} from 'motion/react';
import {projectCapture} from '@/content/portfolio-assets';
import {useWaterMotion} from './water-surface';
import styles from './portfolio-plate.module.css';
import {IsitusaIdentity} from './isitusa-identity';

const notes:Record<string,{opening:string;copy:string;detail:string;detailCopy:string;mobile:string;points:string[]}>= {
 'sage-burress': {opening:'Meet the person behind the photographs.',copy:'Sage’s portrait and introduction sit together. The navigation keeps her services in reach as visitors begin to explore.',detail:'A gallery with room to breathe.',detailCopy:'A quiet editorial frame lets each photograph keep its character. Categories and captions help visitors understand the range of the work.',mobile:'A personal introduction, wherever it starts.',points:['An introduction in Sage’s own voice.','Distinct paths for each creative service.','Photography with room to be seen.']},
 'masonry-color-corrections':{opening:'Let the work explain the difference.',copy:'The service is introduced in plain language, with real before-and-after photographs and a clear path to an estimate.',detail:'The result, with its context.',detailCopy:'The gallery puts the original masonry beside the corrected surface. Project notes explain what changed and how the matching was approached.',mobile:'From a question to an estimate.',points:['A clear explanation of the service.','Real project photographs.','An estimate request within reach.']},
 isitusa:{opening:'An identity built around discovery.',copy:'A custom typeface and botanical identity give a research platform its own voice. The map connects national records to the places visitors know.',detail:'Useful research, thoughtfully organized.',detailCopy:'Species search, categories, and concise summaries make a large collection easier to explore. The public interface is supported by custom data, research, and volunteer systems.',mobile:'A place to begin, on any screen.',points:['County and species search.','A map that adapts to the viewport.','Sources and research context close by.']}
};
export function PortfolioPlate({slug,view,cover,title}:{slug:string;view:number;cover:string|null|undefined;title:string}){
 const {playing}=useWaterMotion();const note=notes[slug];
 return <div className={styles.plate} data-project={slug} data-view={view} data-playing={playing}>
  <div className={styles.folio}><span>{slug==='isitusa'?<IsitusaIdentity/>:title}</span><span>{view===0?'Desktop website':view===1?'Selected website details':'Mobile website'}</span></div>
  <AnimatePresence mode="wait" initial={false}><motion.div key={view} className={styles.art} initial={playing?{opacity:0,filter:'blur(8px)'}:false} animate={{opacity:1,filter:'blur(0px)'}} exit={{opacity:0,filter:playing?'blur(8px)':'none'}} transition={{duration:playing?.65:0,ease:[.22,.7,.25,1]}}>
   {view<2?<div className={styles.opening}>
    <div className={styles.openingNote}><span>{view===0?note?.opening:note?.detail}</span><p>{view===0?note?.copy:note?.detailCopy}</p></div>
    <figure className={styles.websiteFrame}>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={view===0?(cover??projectCapture(slug,'desktop')):projectCapture(slug,'detail')} alt={`${title}, ${view===0?'the opening page':'a detail from the live website'}`} width={1440} height={1000}/>
     <figcaption>The website · {view===0?'Opening page':'Selected detail'} · October 2026</figcaption>
    </figure>
   </div>:<div className={styles.mobile}>
    <div><h3>{note?.mobile}</h3><ol>{note?.points.map((point,i)=><li key={point}><span>0{i+1}</span>{point}</li>)}</ol></div>
    <figure>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={projectCapture(slug,'mobile')} width={390} height={844} alt={`${title}, mobile website layout`}/>
    </figure>
   </div>}
  </motion.div></AnimatePresence>
 </div>;
}

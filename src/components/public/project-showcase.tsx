"use client";
import {scrollToWaterTop} from "./water-viewport";
import Link from "next/link";
import {TablerIcon} from "@/components/ui/tabler-icon";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import type {ContentItem} from "@/lib/content-types";
import {useWaterMotion} from "./water-surface";
import styles from "./studio-pages.module.css";
import gallery from "./project-gallery.module.css";
import {contentWaterMotion} from './content-water-motion';
import {portfolioProjects} from "@/content/portfolio-assets";
import {PortfolioPlate} from "./portfolio-plate";
import {IsitusaIdentity} from "./isitusa-identity";
import {LiquidControl} from "./liquid-control";
import {useProjectEmergence} from "./use-project-emergence";

type Project=ContentItem & {hasViews:boolean};
const stories:Record<string,{intro:string;decision:string;slides:{title:string;copy:string}[]}>= {
 "sage-burress":{intro:"Sage Burress models, creates content, and works in makeup and henna. A visitor might arrive looking for any one of those things. The website brings them together, with a portfolio to explore and a separate page for each service.",decision:"We kept the opening personal and let the photographs take up most of the space. Visitors can get a sense of Sage’s work before choosing the service or collaboration they want to ask about.",slides:[{title:"An introduction before the portfolio.",copy:"The opening pairs Sage’s name with a portrait and a short introduction. Service links give visitors a place to go once they know a little about her."},{title:"Give the photographs room.",copy:"Portraits have different shapes and moods. The gallery gives them a common structure while leaving enough space to look at each one."},{title:"A portfolio that travels well.",copy:"On a phone, the introduction comes first and the photographs follow. Service links stay easy to find without covering the work."}]},
 "masonry-color-corrections":{intro:"New brickwork can look out of place beside an older building. Masonry Color Corrections matches the color of brick and mortar on repairs and additions. We built a website that helps property owners understand what that work involves.",decision:"Before-and-after photographs show the results directly. Short explanations cover the available services, and the estimate form asks for a location, a description, and photographs so the first conversation can be useful.",slides:[{title:"Make the service easy to understand.",copy:"The opening tells visitors what the business does and gives them a straightforward way to ask for an estimate."},{title:"The same wall, before and after.",copy:"The original masonry and the finished correction sit side by side. The project story explains the matching work, so visitors can understand what they’re seeing."},{title:"Keep the next step close.",copy:"The mobile layout keeps the service explanation, project examples, and estimate link close together. A property owner can find the relevant work and enquire from their phone."}]}
};
stories.isitusa={intro:"Isitusa makes invasive-species research easier to explore, starting with the places people know. We took the project from its first idea to a complete identity and working platform.",decision:"Our work spans naming, brand strategy, the logo, and a custom typeface, through to website design, an interactive county map, a backend for data and research management, and internal tools for volunteers. The public experience and the systems behind it were designed together.",slides:[{title:"Start with a place.",copy:"The county map turns a national collection of records into something visitors can explore locally. Search, filters, and clear sources keep the next step useful."},{title:"Make the research approachable.",copy:"The species directory connects names, descriptions, and evidence in a consistent interface. A custom visual identity gives the platform a recognizable voice."},{title:"Research within reach.",copy:"The mobile layout brings place search, the map, and species exploration into a compact view without losing the context of the records."}]};
const views=["The opening","A closer look","On a smaller screen"];
export function ProjectShowcase({projects}:{projects:Project[]}){
 const {playing}=useWaterMotion();
 const [active,setActive]=useState<number|null>(null),[view,setView]=useState(0),[take,setTake]=useState(0),[changing,setChanging]=useState(false),[visible,setVisible]=useState(false);
 const gridHost=useRef<HTMLDivElement>(null),indexScroll=useRef(0);
 const indexHost=useRef<HTMLElement|null>(null),exitAnimation=useRef<Animation|null>(null);
 const arrowReady=useProjectEmergence(indexHost,active===null);
 const pendingFocus=useRef<number | "detail" | null>(null);
 const stage=useRef<HTMLDivElement>(null),film=useRef<HTMLDivElement>(null),swipe=useRef<number|null>(null),busy=useRef(false);
 const item=active===null?undefined:projects[active],story=item?stories[item.slug]:undefined;
 useEffect(()=>{const el=film.current;if(!el)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.2});observer.observe(el);return()=>observer.disconnect();},[active]);
 useLayoutEffect(()=>{
  exitAnimation.current?.cancel();exitAnimation.current=null;
  const target=active===null?null:stage.current;if(!target)return;
  const animation=playing?contentWaterMotion(target,true,850):null;
  return()=>animation?.cancel();
 },[active,playing]);
 useLayoutEffect(()=>{
  if(changing||pendingFocus.current===null)return;
  const destination=pendingFocus.current;pendingFocus.current=null;
  if(destination==='detail')stage.current?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});
  else {window.scrollTo({top:indexScroll.current,behavior:'instant'});document.querySelectorAll<HTMLButtonElement>('[data-project-card]')[destination]?.focus({preventScroll:true});}
 },[active,changing]);
 async function move(next:number|null){
  if(next===active||busy.current||(next!==null&&(next<0||next>=projects.length)))return;
  busy.current=true;setChanging(true);
  const prior=active,element=active===null?indexHost.current:stage.current;
  if(active===null)indexScroll.current=window.scrollY;
  if(playing&&element){exitAnimation.current=contentWaterMotion(element,false,380);await exitAnimation.current.finished.catch(()=>{});}
  pendingFocus.current=next===null?(prior??0):'detail';
  setActive(next);setView(0);setTake(0);if(next!==null)scrollToWaterTop();
  requestAnimationFrame(()=>{busy.current=false;setChanging(false);});
 }
 const close=()=>void move(null);
 const open=(index:number)=>void move(index);
 if(active===null)return <section key="project-index" ref={indexHost} className={gallery.index} aria-label="Selected projects">
  <header className={gallery.intro}><h2 data-project-title="" data-project-emergence="waiting">What we&apos;ve created, and why</h2><div className={gallery.introArrow}><LiquidControl href="#project-grid" label="Explore the projects" active={arrowReady} onAction={keyboard=>{gridHost.current?.scrollIntoView({behavior:playing?"smooth":"instant",block:"start"});if(keyboard)gridHost.current?.focus({preventScroll:true});}}/><noscript><a className={gallery.noScriptArrow} href="#project-grid" aria-label="Explore the projects"><TablerIcon name="arrow-down" size={26}/></a></noscript></div></header>
  <div id="project-grid" ref={gridHost} className={gallery.grid} tabIndex={-1} aria-label="Project collection">{projects.map((project,i)=>{const identity=portfolioProjects[project.slug];return <button type="button" key={project.id} className={gallery.card} data-project={project.slug} data-project-card="" data-project-emergence="waiting" disabled={changing} onClick={()=>open(i)} aria-label={`Explore ${identity?.mobileName?`${identity.mobileName}: `:''}${identity?.displayName??project.title}`} aria-describedby={identity?.coverNote?`cover-note-${project.slug}`:undefined}>
   <span className={gallery.cardCopy}><span className={gallery.client}>{project.slug==='isitusa'?<IsitusaIdentity/>:identity?.mobileName??project.title}</span><span className={gallery.tags}>{(identity?.services??[]).map(tag=><span key={tag}>{tag}</span>)}</span></span>
   <span className={gallery.visual}>
    <span className={gallery.coverArt}>
    {project.slug==='isitusa'?<span className={gallery.identityLockup}>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={identity.cover} alt="ISITUSA symbol and name" width={840} height={1080} loading="eager"/>
    </span>:<>
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img src={identity?.cover??project.coverImageUrl} alt={identity?.coverAlt??project.title} width={project.slug==='sage-burress'?1080:1536} height={project.slug==='sage-burress'?1619:1024} loading={i<2?'eager':'lazy'}/>
    </>}
    {project.slug==='isitusa'?<span className={gallery.ecologyStudy} aria-hidden="true">
     <span className={gallery.botanicalStudy}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/media/projects/identity-covers-20261016/botanical-collage.webp" alt="" width={1536} height={1024} loading="eager"/>
     </span>
    </span>:null}
    </span>
    <span className={gallery.reveal} aria-hidden="true"><span className={gallery.wordmark}>{project.slug==='isitusa'?<IsitusaIdentity full/>:identity?.wordmark??project.title}</span><span className={gallery.openMark}><TablerIcon name="arrow-up-right" size={26}/></span></span>
    {identity?.coverNote?<span id={`cover-note-${project.slug}`} className={gallery.coverNote}>{identity.coverNote}</span>:null}
   </span>
  </button>;})}</div>
  <div className={gallery.foot}><p>What are you working on?</p><Link href="/#inquiry">Let’s talk about it<TablerIcon name="arrow-up-right" size={22}/></Link></div>
  <noscript><style>{`[data-project-emergence="waiting"]{opacity:1!important}`}</style><nav aria-label="Project stories">{projects.map(project=><p key={project.id}><Link href={`/projects/${project.slug}`}>{project.title}</Link></p>)}</nav></noscript>
 </section>;
 if(!item)return <p className={styles.empty}>Our project stories are being prepared.</p>;
 return <section key="project-detail" className={styles.work} aria-label="Explore our work">
  <div className={styles.workRail}><button className={gallery.back} type="button" onClick={close}><TablerIcon name="arrow-left" size={19}/>All projects</button><div className={styles.arrows}><span aria-live="polite">{String(active+1).padStart(2,'0')} <span>/ {String(projects.length).padStart(2,'0')}</span></span><button type="button" aria-label="Previous project" disabled={active===0||changing} onClick={()=>void move(active-1)}><TablerIcon name="arrow-left" size={21}/></button><button type="button" aria-label="Next project" disabled={active===projects.length-1||changing} onClick={()=>void move(active+1)}><TablerIcon name="arrow-right" size={21}/></button></div></div>
  <div ref={stage} className={styles.projectStage} aria-busy={changing} inert={changing}>
   <div className={styles.projectOverview}><div><h2 tabIndex={-1}>{item.slug==='isitusa'?<IsitusaIdentity full/>:item.title}</h2><div className={gallery.tags} aria-label="Project categories">{(portfolioProjects[item.slug]?.categories??[]).map(category=><span key={category}>{category}</span>)}</div><p>{item.details}</p><a href="#project-film" className={styles.projectScroll}>See the website<TablerIcon name="arrow-down" size={20}/></a></div><div><p>{story?.intro??item.summary}</p><p>{story?.decision??item.body.split('\n\n')[0]}</p></div></div>
   <div ref={film} id="project-film" className={styles.projectFilm} data-playing={playing&&visible} data-project={item.slug} data-view={view} onPointerDown={e=>{if(e.pointerType==='touch')swipe.current=e.clientX;}} onPointerUp={e=>{if(swipe.current===null)return;const delta=e.clientX-swipe.current;swipe.current=null;if(Math.abs(delta)>65)setView(v=>Math.max(0,Math.min(item.hasViews?2:0,v+(delta<0?1:-1))));}} onPointerCancel={()=>{swipe.current=null;}}>
    <PortfolioPlate key={`${active}-${take}`} slug={item.slug} view={view} cover={item.coverImageUrl} title={item.title}/>
    {view!==0?<div className={styles.filmStory} aria-live="polite"><div><h3>{story?.slides[view].title??item.title}</h3><p>{story?.slides[view].copy??item.summary}</p></div></div>:null}
    <div className={styles.filmControls}><div className={styles.viewChoices} role="group" aria-label="Project presentation">{(item.hasViews?views:views.slice(0,1)).map((name,i)=><button key={name} type="button" aria-pressed={view===i} onClick={()=>{setView(i);film.current?.scrollIntoView({block:"start",behavior:playing?"smooth":"instant"});}}><span>0{i+1}</span>{name}</button>)}</div><div className={styles.plateArrows}><button type="button" aria-label="Previous detail" disabled={view===0} onClick={()=>setView(v=>v-1)}><TablerIcon name="arrow-left" size={19}/></button><button type="button" aria-label="Next detail" disabled={!item.hasViews||view===2} onClick={()=>setView(v=>v+1)}><TablerIcon name="arrow-right" size={19}/></button><button className={styles.replay} type="button" onClick={()=>{setTake(t=>t+1);film.current?.scrollIntoView({block:"start",behavior:playing?"smooth":"instant"});}} aria-label="Reset presentation"><TablerIcon name="refresh" size={18}/></button></div></div>
   </div>
   <div className={styles.projectFoot}><span>Design & development</span><Link href={`/projects/${item.slug}`}>View the full project<TablerIcon name="arrow-up-right" size={19}/></Link></div>
  </div>
  <nav className={styles.projectIndex} aria-label="Choose a project">{projects.map((project,i)=><button key={project.id} type="button" aria-pressed={i===active} disabled={changing} onClick={()=>{void move(i);scrollToWaterTop(playing?'smooth':'instant');}}><span>{String(i+1).padStart(2,'0')}</span>{project.title}<TablerIcon name="arrow-up-right" size={18}/></button>)}</nav>
  <div className={styles.closing}><p>Have something in mind?<br/>We’d love to hear it.</p><Link href="/#inquiry">Inquire<TablerIcon name="arrow-right" size={22}/></Link></div>
  <noscript><nav aria-label="Project stories">{projects.map(project=><p key={project.id}><Link href={`/projects/${project.slug}`}>{project.title}</Link></p>)}</nav></noscript>
 </section>;
}

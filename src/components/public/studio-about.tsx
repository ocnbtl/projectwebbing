"use client";

import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { useWaterMotion } from './water-surface';
import {contentWaterMotion} from './content-water-motion';
import { StudioSculpture } from './studio-sculpture';
import styles from './studio-about.module.css';

function Capability({ kind, children, end = ',' }: { kind: string; children: string; end?: string }) {
  const root = useRef<HTMLElement>(null);
  const animations = useRef<Animation[]>([]);
  const { playing } = useWaterMotion();
  useEffect(() => () => animations.current.forEach(animation => animation.cancel()), []);
  useEffect(() => { if (!playing) animations.current.forEach(animation => animation.cancel()); }, [playing]);
  const squeeze = () => {
    if (!playing || animations.current.some(animation => animation.playState === 'running')) return;
    animations.current = [...(root.current?.querySelectorAll<HTMLElement>(`.${styles.capabilityInk}`) ?? [])].map(word => word.animate([
      { transform: 'scale(1)', fontWeight: 700, offset: 0, easing: 'cubic-bezier(.42,0,.22,1)' },
      { transform: 'scale(1.02,1.27)', fontWeight: 800, offset: .32, easing: 'cubic-bezier(.22,1,.36,1)' },
      { transform: 'scale(1)', fontWeight: 700, offset: 1 },
    ], { duration: 1750, easing: 'linear' }));
  };
  const words = children.split(' ');
  return <strong ref={root} className={styles.capability} data-capability={kind} role="button" tabIndex={0} aria-label={children} onClick={squeeze} onKeyDown={event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) squeeze(); }
  }}>
    {words.map((word, index) => <Fragment key={`${index}-${word}`}>
      {index > 0 ? ' ' : null}
      <span className={styles.capabilityUnit}>
        <span className={styles.capabilityWord}>
          <span className={styles.capabilityMeasure} aria-hidden="true">{word}</span>
          <span className={styles.capabilityInk}>{word}</span>
        </span>
        {index === words.length - 1 && <span className={styles.capabilityPunctuation}>{end}</span>}
      </span>
    </Fragment>)}
  </strong>;
}

export function StudioAbout() {
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const element=root.current;if(!element)return;
    let disposed=false;const animations:Animation[]=[];
    const reveal=()=>{
      if(disposed)return;
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
        element.querySelectorAll<HTMLElement>('p').forEach((paragraph,index)=>{
          animations.push(contentWaterMotion(paragraph,true,1250+index*120,matchMedia("(max-width: 900px), (pointer: coarse)").matches));
        });
        const visual=element.querySelector<HTMLElement>('[data-about-visual]');
        if(visual)animations.push(contentWaterMotion(visual,true,1500,true));
        window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:.4,y:.35,strength:.3,duration:1.7}}));
      }
      element.dataset.entered='true';
    };
    void document.fonts.ready.then(reveal);
    return()=>{disposed=true;animations.forEach(animation=>animation.cancel());};
  },[]);
  return (
    <div ref={root} className={styles.about} data-entered="false">
      <section className={styles.opening} aria-label="About Madagin">
        <div className={styles.introduction}>
          <div className={styles.copy}>
            <p>Madagin is a forward-thinking design studio based in the USA.<br className={styles.desktopBreak} />{' '}We work closely with our clients to create brands and websites that reflect who they are and where they want to go.</p>
            <p>
              Our capabilities span{' '}
              <Capability kind="brand">branding &amp; identity</Capability>{' '}
              <Capability kind="direction">creative direction</Capability>{' '}
              <Capability kind="web">website design &amp; development</Capability>{' '}
              <Capability kind="systems">custom systems &amp; integrations</Capability> and{' '}
              <Capability kind="search" end=".">search optimization</Capability>
              {' '}Across everything we do, we combine intelligent strategy, cutting-edge technology, and world-class design to elevate your presence and help the right people find you.
            </p>
            <p className={styles.closingCopy}>We carry each project through with precision, giving the smallest interaction the same attention as the first impression. We care about how it looks, how it feels, what it conveys, and where it takes you. Getting it right <span className={styles.closingTail}>matters to us.</span></p>
          </div>
        </div>
        <div className={styles.visual} data-about-visual=""><StudioSculpture /></div>
      </section>
    </div>
  );
}

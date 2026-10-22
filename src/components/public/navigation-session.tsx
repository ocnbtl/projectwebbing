"use client";
import {useCallback,useLayoutEffect,useRef,useSyncExternalStore} from 'react';

const key='madagin:navigation-revealed';
let revealed=false;
export function hasSeenNavigation(){
 if(typeof window==='undefined')return false;
 try{return revealed||sessionStorage.getItem(key)==='true';}catch{return revealed;}
}
export const subscribeNavigation=()=>()=>{};
export const navigationServerSnapshot=()=>false;
export function useRetainedNavigation(){
 const initial=useRef<boolean|null>(null);
 const snapshot=useCallback(()=>{if(initial.current===null)initial.current=hasSeenNavigation();return initial.current;},[]);
 return useSyncExternalStore(subscribeNavigation,snapshot,navigationServerSnapshot);
}

/** Keep the first reveal special, then preserve the navigation for this visit. */
export function NavigationSession({visible,children}:{visible:boolean;children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!visible)return;
  if(ref.current)ref.current.dataset.navigationRetained=String(hasSeenNavigation());
  revealed=true;
  try{sessionStorage.setItem(key,'true');}catch{/* In-memory continuity when storage is unavailable. */}
 },[visible]);
 return <div ref={ref} style={{display:'contents'}}>{children}</div>;
}

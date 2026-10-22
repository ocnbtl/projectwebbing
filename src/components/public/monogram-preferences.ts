"use client";
import {useSyncExternalStore} from 'react';
import catalog from './monogram-glyphs.json';
import defaults from './monogram-defaults.json';
const key='madagin-monogram-fonts-v1',event='madagin:monogram-fonts';
export const monogramFamilies=catalog.M.versions.map(face=>face.family);
const read=()=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
const subscribe=(notify:()=>void)=>{window.addEventListener('storage',notify);window.addEventListener(event,notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener(event,notify);};};
export function useMonogramFonts(){
 const value=useSyncExternalStore(subscribe,read,()=>''),valid=(()=>{try{const list=JSON.parse(value);return Array.isArray(list)?list.filter(name=>monogramFamilies.includes(name)):defaults;}catch{return defaults;}})();
 return valid.length?valid:defaults;
}
export function saveMonogramFonts(names:string[]){localStorage.setItem(key,JSON.stringify(names));window.dispatchEvent(new Event(event));}

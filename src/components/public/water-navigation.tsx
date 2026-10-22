"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWaterMotion } from "./water-surface";
import {contentWaterMotion} from './content-water-motion';
import {scrollToWaterTop} from './water-viewport';

/** The water survives navigation. Only the content sinks and resurfaces. */
export function WaterNavigation({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { motion } = useWaterMotion();
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useLayoutEffect(() => {
    busy.current = false;
    const element = root.current;
    if (!element) return;
    window.dispatchEvent(new Event("madagin:route-layout"));
    document.documentElement.removeAttribute("data-water-transition");
    element.removeAttribute("aria-busy");
    element.getAnimations({ subtree: true }).filter(a => a.id === "water-exit").forEach(a => a.cancel());
    if (pathname!=="/") delete document.documentElement.dataset.waterDestination;
    if (pathname.startsWith("/internal") || pathname === "/") return;
    const animate=!matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(!animate){element.dataset.routeReady="true";return;}
    const smooth = true;
    const enters = [...element.querySelectorAll<HTMLElement>(pathname==="/about"?"footer":"main,footer")].map(target=>contentWaterMotion(target,true,smooth?1100:850,smooth));
    element.dataset.routeReady="true";
    if (smooth) window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:.35,y:.3,strength:.35,duration:1.4}}));
    return () => enters.forEach(animation=>animation.cancel());
  }, [pathname]);
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      if (!motion || pathname.startsWith("/internal") || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.hasAttribute("download") || link.hasAttribute("data-home-mark")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/internal") || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault();
      if (busy.current) return;
      busy.current = true;
      router.prefetch(url.pathname);
      document.documentElement.dataset.waterTransition="out";
      window.dispatchEvent(new Event("madagin:route-layout"));
      if (link.closest("nav")) link.animate([{ color:"#f4cbb9" }, { color:"#bce4d9", offset:.45 }, { color:"#d3c5ee", offset:.75 }, { color:"#f3f7fb" }], { duration:420 });
      root.current?.setAttribute("aria-busy", "true");
      const b=link.getBoundingClientRect();window.dispatchEvent(new CustomEvent('madagin:surface-pulse',{detail:{x:(b.left+b.width/2)/innerWidth,y:(b.top+b.height/2)/innerHeight,strength:.65,duration:1.4}}));
      const animations = [...(root.current?.querySelectorAll<HTMLElement>("main,footer")??[])].map(target=>contentWaterMotion(target,false,460,true));
      animations.forEach(animation=>{animation.id = "water-exit";});
      timer.current = setTimeout(() => {
        // Reset while the old content is submerged. Letting Next reset to zero
        // afterwards exposes the mobile water lead-in as extra page spacing.
        document.documentElement.dataset.waterDestination=url.hash==="#inquiry"?"inquiry":"";
        scrollToWaterTop();
        window.dispatchEvent(new Event("madagin:route-layout"));
        // The home flow owns this anchor. Passing it through the router as well
        // can race its phase update and briefly scroll to the old landing panel.
        router.push(url.pathname + url.search + (url.hash==="#inquiry"?"":url.hash), {scroll:!!url.hash&&url.hash!=="#inquiry"});
        // A failed or cancelled navigation must never leave the page hidden.
        timer.current = setTimeout(() => { animations.forEach(animation=>animation.cancel()); document.documentElement.removeAttribute("data-water-transition"); busy.current = false; root.current?.removeAttribute("aria-busy"); }, 4500);
      }, 460);
    };
    document.addEventListener("click", navigate, true);
    return () => { document.removeEventListener("click", navigate, true); clearTimeout(timer.current); };
  }, [router, pathname, motion]);
  return <div ref={root} data-water-content="" data-route={pathname} data-route-ready="false" style={{ position: "relative", zIndex: 1 }}>{children}</div>;
}

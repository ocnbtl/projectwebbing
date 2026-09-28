"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWaterMotion } from "./water-surface";

/** The water survives navigation. Only the content sinks and resurfaces. */
export function WaterNavigation({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { motion } = useWaterMotion();
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    busy.current = false;
    const element = root.current;
    if (!element) return;
    element.removeAttribute("aria-busy");
    element.getAnimations({ subtree: true }).filter(a => a.id === "water-exit").forEach(a => a.cancel());
    if (!motion || pathname.startsWith("/internal")) return;
    const enter = element.animate([{ opacity: .12, transform: "translateY(28px)", filter: "blur(9px)" }, { opacity: 1, transform: "translateY(0)", filter: "blur(0)" }], { duration: 900, easing: "cubic-bezier(.16,1,.3,1)" });
    return () => enter.cancel();
  }, [pathname, motion]);
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      if (!motion || pathname.startsWith("/internal") || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/internal") || (url.pathname === location.pathname && url.search === location.search)) return;
      event.preventDefault();
      if (busy.current) return;
      busy.current = true;
      if (link.closest("nav")) link.animate([{ color:"#f4cbb9" }, { color:"#bce4d9", offset:.45 }, { color:"#d3c5ee", offset:.75 }, { color:"#f3f7fb" }], { duration:420 });
      root.current?.setAttribute("aria-busy", "true");
      const animation = root.current?.animate([{ opacity: 1, transform: "translateY(0)", filter: "blur(0)" }, { opacity: .04, transform: "translateY(42px) scale(.985)", filter: "blur(12px)" }], { duration: 420, easing: "cubic-bezier(.55,0,.8,.45)", fill: "forwards" });
      if (animation) animation.id = "water-exit";
      timer.current = setTimeout(() => {
        router.push(url.pathname + url.search + url.hash);
        // A failed or cancelled navigation must never leave the page hidden.
        timer.current = setTimeout(() => { animation?.cancel(); busy.current = false; root.current?.removeAttribute("aria-busy"); }, 4500);
      }, 420);
    };
    document.addEventListener("click", navigate, true);
    return () => { document.removeEventListener("click", navigate, true); clearTimeout(timer.current); };
  }, [router, pathname, motion]);
  return <div ref={root} data-water-content="" style={{ position: "relative", zIndex: 1 }}>{children}</div>;
}

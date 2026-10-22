import { scrollToWaterTop, waterPageTop } from './water-viewport';

/** Physical-device comparisons show that page-attached canvas pixels can
 * paint under Safari's controls, while fixed canvas pixels are clipped.
 * A root timeline follows scrolling; the renderer supplies the edge pixels. */
export function trackWaterPage(canvas: HTMLCanvasElement) {
  const field = canvas.parentElement!;
  const surface = field.parentElement!;
  const touch = matchMedia('(any-pointer: coarse), (max-width: 900px)');
  const nativeScroll = CSS.supports('animation-timeline', 'scroll(root block)');
  let frame = 0;
  let previousEdge = 0;
  const measure = () => {
    frame = 0;
    if (!touch.matches) return;
    surface.style.setProperty('--water-viewport-height', `${innerHeight}px`);
    surface.style.setProperty('--water-scroll-range', `${Math.max(0, document.documentElement.scrollHeight - innerHeight)}px`);
    surface.style.setProperty('--water-scroll-y', `${Math.max(0, scrollY)}px`);
  };
  const queue = () => { if (!frame && touch.matches) frame = requestAnimationFrame(measure); };
  const configure = () => {
    surface.dataset.pageWater = String(touch.matches);
    surface.dataset.scrollWater = String(touch.matches && nativeScroll);
    const nextEdge = waterPageTop();
    if (nextEdge !== previousEdge && scrollY <= previousEdge + 1 && (!location.hash || location.hash === '#top')) scrollToWaterTop();
    previousEdge = nextEdge;
    measure();
  };
  const routeLayout=()=>{measure();};
  window.addEventListener("madagin:route-layout",routeLayout);
  // Content growth, route changes, font swaps, and toolbar/keyboard resizing.
  const observer = new ResizeObserver(queue);
  observer.observe(document.body);
  observer.observe(document.documentElement);
  window.addEventListener('resize', queue);
  window.visualViewport?.addEventListener('resize', queue);
  if (!nativeScroll) window.addEventListener('scroll', queue, { passive: true });
  touch.addEventListener('change', configure);
  configure();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("madagin:route-layout",routeLayout);
    window.removeEventListener('resize', queue);
    window.visualViewport?.removeEventListener('resize', queue);
    window.removeEventListener('scroll', queue);
    touch.removeEventListener('change', configure);
  };
}

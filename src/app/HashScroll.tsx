"use client";

import { useEffect } from "react";

// Makes a DIRECT load of `/#mission` reliably land on the mission section.
//
// The hard case is initial page load. Next's App Router doesn't consistently
// honor a hash on first paint, and even when the browser does jump, the target's
// final position keeps moving for a while afterward — web fonts swap in, images
// above/around the section finish loading, and hydration can reset scroll. A
// single scroll fires too early and gets stranded (short OR past the section).
//
// So instead of scrolling once, we RE-ASSERT the correct position on every frame
// for a short bounded window, re-correcting after each late shift, and we stop the
// instant the visitor takes over (wheel / touch / key). If there's no shift, each
// re-assert is a no-op, so there's no jitter.
//
// We compute the destination ourselves (element's absolute top minus its CSS
// `scroll-margin-top`, i.e. Tailwind `scroll-mt-24` = 96px) so the sticky header
// never covers the heading, and we scroll instantly (no smooth — some engines
// silently no-op smooth scrolling).
export default function HashScroll() {
  useEffect(() => {
    const id = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    let stopped = false;
    const takeOver = () => {
      stopped = true;
    };
    // Never fight the visitor once they start scrolling themselves.
    window.addEventListener("wheel", takeOver, { passive: true });
    window.addEventListener("touchstart", takeOver, { passive: true });
    window.addEventListener("keydown", takeOver);

    const desiredScrollTop = () => {
      const marginTop = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const absoluteTop = target.getBoundingClientRect().top + window.scrollY;
      return Math.max(0, Math.round(absoluteTop - marginTop));
    };

    const align = () => {
      const desired = desiredScrollTop();
      if (Math.abs(window.scrollY - desired) > 2) window.scrollTo(0, desired);
    };

    // Re-assert every frame for ~1.6s, long enough to outlast font swaps and
    // image loads without holding the page hostage.
    const startedAt = performance.now();
    let raf = requestAnimationFrame(function tick() {
      if (stopped) return;
      align();
      if (performance.now() - startedAt < 1600) raf = requestAnimationFrame(tick);
    });

    // A final correction once every subresource (images) has finished loading —
    // covers a late reflow that lands after the frame window closes.
    const onLoad = () => {
      if (!stopped) align();
    };
    window.addEventListener("load", onLoad);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", takeOver);
      window.removeEventListener("touchstart", takeOver);
      window.removeEventListener("keydown", takeOver);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}

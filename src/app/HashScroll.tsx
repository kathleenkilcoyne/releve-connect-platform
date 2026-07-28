"use client";

import { useEffect } from "react";

// Makes a DIRECT load of `/#mission` reliably land on the mission section.
//
// The in-page "Meet Relevé" click already works: native anchor navigation always
// scrolls to the target. The one thing the browser gets wrong is the first paint
// of `/#mission` — Next's App Router doesn't consistently scroll to a hash on
// load, and when content above the target shifts as web fonts and images settle,
// the browser's early jump lands short and you end up stranded near the top
// (exactly the "loads at the top" symptom). We simply re-run the scroll once
// layout has settled.
//
// We deliberately do NOT intercept clicks or force smooth scrolling: a JS
// `scrollIntoView({ behavior: "smooth" })` can silently no-op in some engines and
// leave a visitor stranded, whereas native navigation is guaranteed to land.
//
// `scrollIntoView({ block: "start" })` honors the target's `scroll-margin-top`
// (Tailwind `scroll-mt-24`), so the sticky header never covers the heading.
export default function HashScroll() {
  useEffect(() => {
    const id = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : "";
    const target = id ? document.getElementById(id) : null;
    if (!target) return;

    const land = () => target.scrollIntoView({ behavior: "auto", block: "start" });
    // Two frames defeats the "scrolled before layout settled" race; fonts.ready
    // catches the late reflow when a web font swaps in and pushes content down.
    const raf = requestAnimationFrame(() => requestAnimationFrame(land));
    document.fonts?.ready.then(land).catch(() => {});

    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}

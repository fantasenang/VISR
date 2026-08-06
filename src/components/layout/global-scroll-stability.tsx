"use client";

import { useEffect } from "react";

export function GlobalScrollStability() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const previous = {
      htmlOverscroll: html.style.overscrollBehaviorY,
      htmlOverflowX: html.style.overflowX,
      bodyOverscroll: body.style.overscrollBehaviorY,
      bodyOverflowX: body.style.overflowX,
      bodyTouchAction: body.style.touchAction,
    };

    html.style.overscrollBehaviorY = "none";
    html.style.overflowX = "hidden";
    body.style.overscrollBehaviorY = "none";
    body.style.overflowX = "hidden";
    body.style.touchAction = "pan-y pinch-zoom";

    return () => {
      html.style.overscrollBehaviorY = previous.htmlOverscroll;
      html.style.overflowX = previous.htmlOverflowX;
      body.style.overscrollBehaviorY = previous.bodyOverscroll;
      body.style.overflowX = previous.bodyOverflowX;
      body.style.touchAction = previous.bodyTouchAction;
    };
  }, []);

  return null;
}

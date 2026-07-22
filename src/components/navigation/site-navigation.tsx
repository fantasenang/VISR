"use client";

import { useEffect, useRef, useState } from "react";

const items = [
  { label: "Halo Collection", href: "#halo" },
  { label: "Carry", href: "#carry" },
  { label: "Exhibition", href: "#exhibition" },
] as const;

export function SiteNavigation() {
  const previousScrollRef = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("up");

  useEffect(() => {
    function revealNavigation() {
      setRevealed(true);
    }

    function hideNavigation() {
      if (window.scrollY < window.innerHeight * 0.55) setRevealed(false);
    }

    function handleScroll() {
      const currentScroll = window.scrollY;
      const delta = currentScroll - previousScrollRef.current;

      if (Math.abs(delta) > 8) setDirection(delta > 0 ? "down" : "up");
      if (currentScroll > window.innerHeight * 0.72) setRevealed(true);
      if (currentScroll < window.innerHeight * 0.42) setRevealed(false);

      previousScrollRef.current = currentScroll;
    }

    window.addEventListener("visr:opening-revealed", revealNavigation);
    window.addEventListener("visr:opening-hidden", hideNavigation);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("visr:opening-revealed", revealNavigation);
      window.removeEventListener("visr:opening-hidden", hideNavigation);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const visible = revealed && direction !== "down";

  return (
    <header className="site-navigation" data-visible={visible ? "true" : "false"}>
      <nav className="visr-container site-navigation__inner" aria-label="Primary navigation">
        <a href="#opening" className="site-navigation__logo" aria-label="VISR home">
          VISR
        </a>

        <div className="site-navigation__links">
          {items.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <a href="#configure" className="site-navigation__action">
          Explore
        </a>
      </nav>
    </header>
  );
}

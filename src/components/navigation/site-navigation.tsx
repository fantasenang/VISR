const items = ["VISR", "Halo Collection", "Carry", "Exhibition"] as const;

export function SiteNavigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/25 backdrop-blur-md">
      <nav className="visr-container flex h-16 items-center justify-between" aria-label="Primary navigation">
        <a href="#opening" className="text-sm font-medium tracking-[0.16em]">VISR</a>
        <div className="hidden items-center gap-7 text-xs text-white/60 md:flex">
          {items.slice(1).map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(" collection", "").replace(" ", "-")}`} className="transition-colors hover:text-white">
              {item}
            </a>
          ))}
        </div>
        <a href="#configure" className="text-xs font-medium text-white/80 transition-colors hover:text-white">
          Explore
        </a>
      </nav>
    </header>
  );
}

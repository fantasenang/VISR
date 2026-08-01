const halos = [
  {
    slug: "crimson",
    name: "Crimson Halo",
    line: "Bold Presence",
    description: "A decisive red tone that turns the display into a statement.",
  },
  {
    slug: "ice",
    name: "Ice Halo",
    line: "Pure Focus",
    description: "A colder atmosphere that removes noise and sharpens the object.",
  },
  {
    slug: "emerald",
    name: "Emerald Halo",
    line: "Quiet Depth",
    description: "A composed green presence with depth that reveals itself slowly.",
  },
  {
    slug: "amber",
    name: "Amber Halo",
    line: "Warm Precision",
    description: "A warm architectural tone with a restrained gallery-like calm.",
  },
  {
    slug: "pink",
    name: "Pink Halo",
    line: "Unexpected Elegance",
    description: "A playful tone held inside a restrained and precise display system.",
  },
] as const;

export function HaloCollection() {
  return (
    <section
      id="halo"
      className="border-t border-white/[0.07] bg-[#020202] py-24 text-[#f7f7f5] md:py-36"
      aria-labelledby="halo-collection-title"
    >
      <div className="visr-container">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <p className="visr-label text-white/42">Halo Collection</p>
          </div>
          <div className="md:col-span-7 md:col-start-6">
            <h2
              id="halo-collection-title"
              className="max-w-[10ch] text-[clamp(3rem,6.5vw,7rem)] font-normal leading-[0.94] tracking-[-0.055em]"
            >
              Choose your Halo.
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-6 text-white/48">
              Five personalities. One display philosophy. Presented without animation so the collection stays fast and stable on mobile.
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-5">
          {halos.map((halo, index) => (
            <article key={halo.slug} className="bg-[#020202]">
              <div className="aspect-[4/5] overflow-hidden bg-[#050505]">
                <img
                  src={`/images/halo/halo-${halo.slug}.webp`}
                  alt={`${halo.name} VISR Carry display`}
                  width={447}
                  height={558}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-h-48 p-5">
                <p className="text-[10px] tracking-[0.16em] text-white/32">
                  {String(index + 1).padStart(2, "0")} / 05
                </p>
                <h3 className="mt-4 text-xl font-normal tracking-[-0.035em]">{halo.name}</h3>
                <p className="mt-1 text-xs text-white/42">{halo.line}</p>
                <p className="mt-5 text-xs leading-5 text-white/42">{halo.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-5 border-t border-white/[0.08] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/45">Available separately with VISR Carry Gen 2.</p>
          <a
            href="/checkout"
            className="w-fit rounded-full border border-white/15 px-6 py-3 text-sm text-white/70 transition-colors hover:bg-white hover:text-black"
          >
            Reserve your Halo
          </a>
        </div>
      </div>
    </section>
  );
}

const sequences = [
  { number: "01", title: "Presentation", feeling: "Meaning", line: "The frame is not the product. Your collection is." },
  { number: "02", title: "Engineered", feeling: "Confidence", line: "Nothing unnecessary. Every detail earns its place." },
  { number: "03", title: "Halo Collection", feeling: "Expression", line: "Six expressions. One system." },
  { number: "04", title: "VISR Carry", feeling: "Arrival", line: "Arrive with confidence." },
  { number: "05", title: "Exhibition", feeling: "Projection", line: "Collected with passion. Presented with purpose." },
  { number: "06", title: "Make It Yours", feeling: "Ownership", line: "Your collection deserves its moment." },
] as const;

export function StoryMap() {
  return (
    <section id="reveal-map" className="border-t border-white/[0.07] py-28 md:py-40">
      <div className="visr-container">
        <div className="mb-20 grid gap-8 md:grid-cols-12">
          <p className="visr-label text-white/38 md:col-span-3">Reveal Architecture</p>
          <div className="md:col-span-8 md:col-start-5">
            <h2 className="max-w-[12ch] text-4xl font-normal leading-[1.02] tracking-[-0.045em] md:text-6xl">
              Curiosity becomes discovery. Discovery becomes desire.
            </h2>
          </div>
        </div>

        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {sequences.map((sequence) => (
            <article key={sequence.number} className="group grid gap-5 py-8 md:grid-cols-12 md:items-center md:py-10">
              <span className="font-mono text-xs text-white/30 md:col-span-1">{sequence.number}</span>
              <h3 className="text-2xl font-normal tracking-[-0.025em] md:col-span-3 md:text-3xl">{sequence.title}</h3>
              <p className="visr-copy md:col-span-5">{sequence.line}</p>
              <p className="visr-label text-white/35 md:col-span-2 md:col-start-11 md:text-right">{sequence.feeling}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

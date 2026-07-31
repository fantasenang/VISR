const genTwoUpdates = [
  {
    title: "VISR Link included",
    copy: "Two VISR Link modules are included with every Carry Gen 2, creating the connection point between the display and the collection.",
  },
  {
    title: "Updated carry strap",
    copy: "The Gen 2 strap has been revised for a cleaner, more considered carrying experience while preserving the object-first silhouette.",
  },
  {
    title: "Built as a system",
    copy: "Carry is the portable foundation. VISR Link is designed to extend into future VISR display formats without changing how the collection connects.",
  },
] as const;

const answers = [
  {
    question: "What exactly am I buying?",
    answer: "One VISR Carry Gen 2 display and two VISR Link modules. The diecast car and Halo Collection are not included.",
  },
  {
    question: "Is this ready stock?",
    answer: "No. Batch 2 is produced after preorder closes. Production takes a maximum of 14 business days, followed by final inspection and dispatch.",
  },
  {
    question: "Why preorder instead of waiting?",
    answer: "The preorder price is Rp179.000. Any remaining ready stock will be Rp199.000 after production, subject to availability.",
  },
  {
    question: "When will my unit ship?",
    answer: "Completed units are dispatched after they pass final inspection. VISR does not hold finished units until the entire batch is complete.",
  },
] as const;

export function ProductClarity() {
  return (
    <section id="gen-2" className="border-t border-white/[0.07] py-24 md:py-40">
      <div className="visr-container">
        <div className="grid gap-14 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="visr-label text-white/42">Carry Gen 2</p>
            <h2 className="mt-6 text-[clamp(2.7rem,5vw,5.8rem)] font-normal leading-[0.96] tracking-[-0.05em]">
              A portable display, now built around VISR Link.
            </h2>
          </div>

          <div className="md:col-span-7 md:col-start-6">
            <p className="max-w-2xl text-lg leading-8 text-white/62">
              VISR Carry turns a 1:64 collection into an object worth carrying and presenting. Gen 2 introduces the modular VISR Link connection and a revised strap, while keeping the collection—not the enclosure—as the visual focus.
            </p>

            <div className="mt-14 divide-y divide-white/10 border-y border-white/10">
              {genTwoUpdates.map((item, index) => (
                <div key={item.title} className="grid gap-4 py-8 sm:grid-cols-[3rem_1fr]">
                  <span className="font-mono text-xs tracking-[0.16em] text-white/28">0{index + 1}</span>
                  <div>
                    <h3 className="text-xl text-white/88">{item.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/48">{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-24 grid gap-8 border-t border-white/10 pt-12 md:mt-36 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="visr-label text-white/42">Before You Reserve</p>
            <h2 className="mt-5 text-3xl leading-tight tracking-[-0.035em]">Clear answers, before checkout.</h2>
          </div>
          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 md:col-span-7 md:col-start-6">
            {answers.map((item) => (
              <div key={item.question}>
                <h3 className="text-base text-white/82">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-white/46">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

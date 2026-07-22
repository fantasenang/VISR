"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="visr-container flex min-h-screen flex-col items-start justify-center">
      <p className="visr-label mb-5 text-white/40">Experience interrupted</p>
      <h1 className="max-w-xl text-4xl font-normal tracking-[-0.04em] md:text-6xl">This view could not be revealed.</h1>
      <button type="button" onClick={reset} className="mt-10 rounded-full bg-[#f7f7f5] px-6 py-3 text-sm font-medium text-[#070707]">Retry</button>
    </main>
  );
}

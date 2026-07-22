export default function NotFound() {
  return (
    <main className="visr-container flex min-h-screen flex-col items-start justify-center">
      <p className="visr-label mb-5 text-white/40">404</p>
      <h1 className="text-5xl font-normal tracking-[-0.045em] md:text-7xl">Nothing to reveal here.</h1>
      <a href="/" className="mt-10 rounded-full border border-white/15 px-6 py-3 text-sm transition-colors hover:bg-white hover:text-black">Return to VISR</a>
    </main>
  );
}

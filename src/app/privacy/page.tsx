import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How VISR uses order data, anonymous traffic analytics, and optional advertising measurement.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-10 sm:py-24">
        <Link href="/" className="visr-label text-white/40 transition hover:text-white/70">
          ← Return to VISR
        </Link>

        <p className="visr-label mt-16 text-white/35">Privacy Notice</p>
        <h1 className="mt-5 text-5xl tracking-[-0.055em] sm:text-7xl">
          Your order data stays tied to the VISR experience.
        </h1>
        <p className="mt-8 max-w-2xl text-base leading-8 text-white/60">
          VISR collects the information required to reserve, pay for, prepare,
          ship, and support your order. Anonymous website analytics help VISR
          understand traffic and performance. Meta advertising measurement
          remains optional and off by default.
        </p>

        <div className="mt-16 space-y-12 border-t border-white/10 pt-12 text-sm leading-7 text-white/55">
          <section>
            <h2 className="text-xl text-white">Information used for an order</h2>
            <p className="mt-4">
              This can include your name, email address, WhatsApp number,
              delivery address, postal code, selected products, shipping
              service, payment status, and order notes. VISR uses this data to
              operate the preorder, arrange delivery, provide support, prevent
              duplicate or fraudulent requests, and maintain transaction
              records.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-white">Essential storage</h2>
            <p className="mt-4">
              VISR uses first-party browser storage and cookies for functions
              such as preserving checkout state, protecting admin access, and
              returning you to the correct payment or order screen. These
              functions are required for the website to operate reliably.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-white">Anonymous website analytics</h2>
            <p className="mt-4">
              VISR uses Vercel Web Analytics and Speed Insights to understand
              page visits, broad traffic sources, device categories, location
              at an aggregated level, and website performance. Vercel Web
              Analytics is designed without analytics cookies and reports
              aggregated traffic rather than building a persistent customer
              profile across websites.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-white">Optional Meta measurement</h2>
            <p className="mt-4">
              Meta Pixel remains off unless you select “Allow Meta
              measurement” through Privacy Choices. When allowed, VISR may
              measure product interest and checkout actions. After a completed
              production payment, VISR may also send a Purchase event to Meta
              through Conversions API. Customer identifiers used for matching
              are normalized and cryptographically hashed before transmission.
            </p>
            <p className="mt-4">
              Selecting “Keep Meta off,” or making no selection, keeps Meta
              advertising measurement disabled for your browser and prevents
              the order from being marked as eligible for VISR’s Meta Purchase
              reporting.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-white">Payment and delivery providers</h2>
            <p className="mt-4">
              Payment information is processed through Midtrans. Delivery
              information may be used with shipping and logistics providers to
              calculate rates and fulfill the order. VISR does not store your
              card, bank, or wallet credentials on this website.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-white">Retention and access</h2>
            <p className="mt-4">
              Order and transaction records are retained for operational,
              support, accounting, dispute, and legal requirements. Access is
              limited to the systems and people required to run VISR. You may
              ask about your order data or request a correction through VISR’s
              support channel.
            </p>
            <a
              href="https://wa.me/6281806288892"
              className="mt-5 inline-flex rounded-full border border-white/15 px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-white/65 transition hover:border-white/30 hover:text-white"
            >
              Contact VISR Support
            </a>
          </section>

          <section>
            <h2 className="text-xl text-white">Change Meta measurement</h2>
            <p className="mt-4">
              Use the <strong className="font-medium text-white/80">Privacy · Choices</strong>
              control shown on the website to allow or disable optional Meta
              advertising measurement. The new choice applies to future
              activity in that browser.
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8 text-xs leading-6 text-white/35">
          <p>VISR · Carry Your Build.</p>
          <p className="mt-2">Last updated: 2 August 2026</p>
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How VISR uses essential checkout data and optional measurement tools.",
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
        <p className="mt-8 max-w-2xl text-base leading-8 text-white/58">
          VISR collects the information required to reserve, pay for, prepare,
          ship, and support your order. Optional measurement tools remain off
          until you choose to allow them.
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
              such as remembering your privacy choice, preserving checkout
              state, protecting admin access, and returning you to the correct
              payment or order screen. These functions are required for the
              website to operate reliably.
            </p>
          </section>

          <section>
            <h2 className="text-xl text-white">Optional measurement</h2>
            <p className="mt-4">
              When you select “Allow measurement,” VISR may load Meta Pixel and
              Vercel Analytics to measure page visits, product interest,
              checkout actions, and website performance. After a completed
              production payment, VISR may also send a Purchase event to Meta
              through Conversions API. Customer identifiers used for matching
              are normalized and cryptographically hashed before transmission.
            </p>
            <p className="mt-4">
              If you select “Essential only,” advertising and performance
              measurement stays disabled for your browser, and the order is not
              marked as eligible for VISR’s Meta Purchase reporting.
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
          </section>

          <section>
            <h2 className="text-xl text-white">Change your choice</h2>
            <p className="mt-4">
              Use the <strong className="font-medium text-white/80">Privacy · Choices</strong>
              control shown on the website to switch between optional
              measurement and essential-only operation. The new choice applies
              to future activity in that browser.
            </p>
          </section>
        </div>

        <div className="mt-16 border-t border-white/10 pt-8 text-xs leading-6 text-white/35">
          <p>VISR · Carry Your Build.</p>
          <p className="mt-2">Last updated: 1 August 2026</p>
        </div>
      </div>
    </main>
  );
}

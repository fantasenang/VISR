"use client";

import { useEffect, useRef, useState } from "react";

const faqItems = [
  {
    question: "What is VISR Carry?",
    answer:
      "VISR Carry is a handmade visor display created to carry and present 1:64 diecast through a magnetic mounting system. The car aligns to the frame through VISR Link, keeping the display focused on the collection rather than a conventional case.",
  },
  {
    question: "What is included with VISR Carry?",
    answer:
      "Each package includes 1× VISR Carry, 1× VISR Link, and 1× strap. The diecast car and Halo Collection are sold separately.",
  },
  {
    question: "Which diecast cars are compatible?",
    answer:
      "VISR Carry is designed for 1:64 diecast, especially sports cars and hypercars. The display chamber measures 100 × 40 × 25 mm, so the car must remain within those dimensions. Measure unusually long, wide, or tall castings before ordering.",
  },
  {
    question: "How is the car installed?",
    answer:
      "Attach VISR Link to the underside of the car using the pre-applied 3M VHB adhesive, then place it onto the magnetic base. No drilling, screws, or permanent modification is required. The N52 magnetic interface allows the car to be attached and removed repeatedly.",
  },
  {
    question: "Why would I need an Additional VISR Link?",
    answer:
      "Every VISR Carry includes one VISR Link. An Additional VISR Link lets another car remain prepared for the system, so you can swap cars without removing and reinstalling the adhesive link. VISR Link is also the foundation for future VISR display products.",
  },
  {
    question: "Is Halo Collection included?",
    answer:
      "No. Halo Collection will be sold separately and is compatible with VISR Carry. Its launch date has not been announced, and it will be introduced to all customers rather than offered as a private Batch 2 release.",
  },
  {
    question: "How does the Batch 2 preorder work?",
    answer:
      "The preorder opens on 7 August 2026 and closes on 13 August at 23.59 WIB, or earlier when the available allocation is fully reserved. Production runs progressively before and throughout the preorder period, and completed units are processed in order sequence.",
  },
  {
    question: "When will my order be shipped?",
    answer:
      "Estimated dispatch is 18–25 August 2026. Each unit is dispatched in order sequence after passing final quality control; VISR does not wait for the entire batch to finish. Tracking is shared by the VISR admin through WhatsApp and is also available through Track Your Order on the website. Current domestic couriers are JNE and J&T. International shipping is not available yet.",
  },
  {
    question: "Which payment methods are available?",
    answer:
      "Payment is available through virtual account and QRIS. A reservation remains active for 24 hours while payment is pending. Inventory is reserved during that payment window and released automatically if payment is not completed.",
  },
  {
    question: "Can I cancel or refund my preorder?",
    answer:
      "An unpaid reservation can be left to expire and will be cancelled automatically after the payment window. A paid preorder is final and cannot normally be cancelled or refunded. If VISR is unable to fulfil an order because of a confirmed inventory error, the affected payment will be refunded.",
  },
  {
    question: "What should I do if the product arrives damaged?",
    answer:
      "Contact VISR through WhatsApp no later than three days after delivery and provide a complete unboxing video. Cracks and significant bubbles may qualify as manufacturing defects. Minor cosmetic marks are not automatically classified as defects. Approved claims are resolved through product replacement.",
  },
  {
    question: "How should I clean VISR Carry?",
    answer:
      "Use a clean, soft microfiber cloth lightly dampened with lukewarm water. For heavier marks, use a small amount of mild soap and blot dry without aggressive rubbing. Do not use alcohol, window cleaner, acetone, abrasive compounds, or a dry dusty cloth on the acrylic visor.",
  },
  {
    question: "Does VISR Carry include a warranty?",
    answer:
      "VISR Carry does not include a general warranty. Manufacturing defects affecting the visor are handled through the damage and defect claim process. Damage caused by drops, impacts, misuse, or incorrect cleaning is not covered. Claims are submitted through WhatsApp support.",
  },
] as const;

const COLLAPSED_FOOTER_CLASS = "visr-footer-collapsed";
const quickSupportLinkClass =
  "text-xs text-white/52 transition-colors duration-300 hover:text-white";

export function VisrFaq() {
  const [open, setOpen] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (window.location.hash === "#faq") setOpen(true);
  }, []);

  useEffect(() => {
    const footer = sectionRef.current?.nextElementSibling;
    if (!(footer instanceof HTMLElement) || footer.tagName !== "FOOTER") return;

    footer.classList.toggle(COLLAPSED_FOOTER_CLASS, !open);
    return () => footer.classList.remove(COLLAPSED_FOOTER_CLASS);
  }, [open]);

  return (
    <section
      id="faq"
      ref={sectionRef}
      className="border-t border-white/[0.07] bg-[#030303]"
    >
      <style>{`
        footer.${COLLAPSED_FOOTER_CLASS} > .visr-container {
          padding-top: 1.5rem;
          padding-bottom: 1.5rem;
        }

        footer.${COLLAPSED_FOOTER_CLASS} > .visr-container > :first-child {
          display: none;
        }

        footer.${COLLAPSED_FOOTER_CLASS} > .visr-container > :last-child {
          padding-top: 0;
        }
      `}</style>

      <div className="visr-container">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="visr-faq-panel"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-6 py-6 text-left"
        >
          <span>
            <span className="visr-label block text-white/32">Support</span>
            <span className="mt-2 block text-base text-white/78">
              Frequently Asked Questions
            </span>
          </span>
          <span className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-white/35">
            {open ? "Close" : "Open"}
            <span
              aria-hidden="true"
              className={`text-xl font-light transition-transform duration-300 ${open ? "rotate-45" : ""}`}
            >
              +
            </span>
          </span>
        </button>

        {!open ? (
          <nav
            aria-label="Quick customer support"
            className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/[0.07] py-4"
          >
            <a href="/order" className={quickSupportLinkClass}>
              Track Your Order
            </a>
            <a
              href="https://wa.me/6281806288892"
              className={quickSupportLinkClass}
            >
              WhatsApp Support
            </a>
          </nav>
        ) : null}

        {open ? (
          <div
            id="visr-faq-panel"
            className="grid gap-14 border-t border-white/10 py-20 md:grid-cols-12 md:py-28"
          >
            <div className="md:col-span-4">
              <p className="visr-label text-white/40">Frequently Asked Questions</p>
              <h2 className="mt-6 max-w-[8ch] text-[clamp(3rem,6vw,6.6rem)] font-normal leading-[0.92] tracking-[-0.055em]">
                Before you carry it.
              </h2>
              <p className="mt-7 max-w-sm text-sm leading-7 text-white/42">
                Product fit, preorder timing, payment, care, and support—collected in one place.
              </p>
            </div>

            <div className="md:col-span-7 md:col-start-6">
              {faqItems.map((item, index) => (
                <details
                  key={item.question}
                  className="group border-t border-white/10 py-0 last:border-b"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
                    <span className="flex gap-4">
                      <span className="pt-1 text-[10px] tracking-[0.18em] text-white/25">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="max-w-xl text-base leading-7 text-white/82">
                        {item.question}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="mt-1 text-xl font-light text-white/35 transition-transform duration-300 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-7 pl-10 pr-10 text-sm leading-7 text-white/48">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

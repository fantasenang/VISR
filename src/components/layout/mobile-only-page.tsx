import type { ReactNode } from "react";
import styles from "./mobile-only-page.module.css";

type MobileOnlyPageProps = {
  children: ReactNode;
};

export function MobileOnlyPage({ children }: MobileOnlyPageProps) {
  return (
    <>
      <div className={styles.content}>{children}</div>
      <main className={styles.gate} aria-labelledby="mobile-only-title">
        <section className={styles.panel}>
          <div className={styles.brandRow}>
            <span>VISR</span>
            <span>Mobile Exhibition</span>
          </div>
          <p className={styles.eyebrow}>Mobile-only experience</p>
          <h1 id="mobile-only-title" className={styles.title}>
            Continue on your phone.
          </h1>
          <p className={styles.copy}>
            VISR is designed, reserved, and paid through mobile. Open visr.works on your phone in portrait orientation to continue.
          </p>
          <div className={styles.url}>visr.works</div>
        </section>
      </main>
    </>
  );
}

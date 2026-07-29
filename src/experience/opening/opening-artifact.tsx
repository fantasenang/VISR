import Image from "next/image";
import styles from "./opening-photo.module.css";

interface OpeningArtifactProps {
  className?: string;
}

export function OpeningArtifact({ className = "" }: OpeningArtifactProps) {
  return (
    <div
      className={`${className} ${styles.artifact}`}
      role="group"
      aria-label="VISR display system editorial product photography"
    >
      <Image
        className={`${styles.photo} ${styles.photoH01}`}
        src="/media/phase-15/visr-h01.webp"
        alt="VISR display system in a dark exhibition setting"
        fill
        priority
        sizes="390px"
        draggable={false}
        data-opening-h01
      />
      <Image
        className={`${styles.photo} ${styles.photoH02}`}
        src="/media/phase-15/visr-h02.webp"
        alt="A second view of the VISR display system"
        fill
        sizes="390px"
        draggable={false}
        data-opening-h02
      />

      <span className={styles.reflection} data-opening-reflection aria-hidden="true" />
      <span className={styles.veil} aria-hidden="true" />
    </div>
  );
}

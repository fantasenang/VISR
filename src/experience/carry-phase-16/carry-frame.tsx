import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./carry-phase-16.module.css";

export type CarryFrameProps = {
  number: string;
  src: string;
  alt: string;
  title: string;
  detail: string;
  imageClassName?: string;
  copyClassName?: string;
  priority?: boolean;
  children?: ReactNode;
};

export function CarryFrame({
  number,
  src,
  alt,
  title,
  detail,
  imageClassName = "",
  copyClassName = "",
  priority = false,
  children,
}: CarryFrameProps) {
  return (
    <article
      className={`${styles.frame} ${imageClassName}`}
      data-carry16-frame
      aria-label={`${number}. ${title}`}
    >
      <div className={styles.media}>
        <div className={styles.photoSlot} aria-hidden="true">
          <span>UPLOAD</span>
          <strong>VISR {number}</strong>
          <small>/media/phase-16/visr-{number.toLowerCase()}.jpg</small>
        </div>

        <Image
          className={styles.image}
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 767px) 100vw, 52vw"
          draggable={false}
        />

        <div className={styles.imageTreatment} aria-hidden="true" />
        {children}
      </div>

      <div className={`${styles.copy} ${copyClassName}`} data-carry16-copy>
        <p className={styles.frameNumber}>{number} / C05</p>
        <h3>{title}</h3>
        <p className={styles.detail}>{detail}</p>
      </div>
    </article>
  );
}

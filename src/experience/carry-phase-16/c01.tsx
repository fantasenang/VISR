import { CarryFrame } from "./carry-frame";
import styles from "./carry-phase-16.module.css";

export function C01() {
  return (
    <CarryFrame
      number="C01"
      src="/media/phase-16/visr-c01.jpg"
      alt="VISR Carry presented as a complete transparent display system"
      title="Designed to carry the display."
      detail="VISR Carry keeps the collection visible, composed, and protected—before the journey even begins."
      imageClassName={styles.c01}
      copyClassName={styles.copyLowerLeft}
      priority
    />
  );
}

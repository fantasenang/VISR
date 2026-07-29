import { CarryFrame } from "./carry-frame";
import styles from "./carry-phase-16.module.css";

export function C03() {
  return (
    <CarryFrame
      number="C03"
      src="/media/phase-16/visr-c03.jpg"
      alt="VISR Carry strap attached through two balanced connection points"
      title="Two points. One balanced system."
      detail="The strap connects through a controlled geometry, distributing the load while keeping the display visually clean."
      imageClassName={styles.c03}
      copyClassName={styles.copyLowerRight}
    />
  );
}

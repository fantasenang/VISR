import { CarryFrame } from "./carry-frame";
import styles from "./carry-phase-16.module.css";

export function C04() {
  return (
    <CarryFrame
      number="C04"
      src="/media/phase-16/visr-c04.jpg"
      alt="VISR Carry worn in motion with the diecast collection still visible"
      title="Made to move with you."
      detail="From shelf to meet, studio to show—the display changes location without changing identity."
      imageClassName={styles.c04}
      copyClassName={styles.copyUpperLeft}
    />
  );
}

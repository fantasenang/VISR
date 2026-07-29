import { CarryFrame } from "./carry-frame";
import styles from "./carry-phase-16.module.css";

export function C05() {
  return (
    <CarryFrame
      number="C05"
      src="/media/phase-16/visr-c05.jpg"
      alt="VISR Carry arriving as a complete portable exhibition for a diecast collection"
      title="Arrive carrying the collection."
      detail="Not a case. Not luggage. A portable exhibition built for collectors who refuse to hide what they carry."
      imageClassName={styles.c05}
      copyClassName={styles.copyLowerLeft}
    />
  );
}

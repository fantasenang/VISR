import { CarryFrame } from "./carry-frame";
import styles from "./carry-phase-16.module.css";

export function C02() {
  return (
    <CarryFrame
      number="C02"
      src="/media/phase-16/visr-c02.jpg"
      alt="Close view of the clear VISR Carry shell protecting a diecast collection"
      title="Protection without interruption."
      detail="The clear Visor guards the object without competing with it. The collection remains the hero from every angle."
      imageClassName={styles.c02}
      copyClassName={styles.copyUpperRight}
    />
  );
}
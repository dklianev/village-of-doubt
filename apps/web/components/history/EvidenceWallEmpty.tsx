import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./Archive.module.css";

export function EvidenceWallEmpty() {
  return (
    <section className={styles.empty} data-state="empty">
      <div>
        <h2>Първата нощ ще остави следа тук.</h2>
        <p>Все още няма завършени публични игри. Частните вечери остават извън този архив.</p>
        <div className={styles.emptyActions}>
          <Link href="/" className={styles.textLink}>Избери игра<ArrowRight size={18} aria-hidden="true" /></Link>
          <Link href="/tutorial" className={styles.textLink}>Първи стъпки<ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
      <Image src="/game-art/history-empty-hero-v2.webp" alt="" width={768} height={512}
        sizes="(max-width: 640px) calc(100vw - 40px), 400px" className={styles.emptyArt} />
    </section>
  );
}

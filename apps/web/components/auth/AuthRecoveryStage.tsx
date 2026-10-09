import { Suspense, type ReactNode } from "react";
import styles from "./AuthRecovery.module.css";

type RecoveryScene = "forgot-password" | "reset-password" | "verify-email";

export function AuthRecoveryStage({ scene, children }: { scene: RecoveryScene; children: ReactNode }) {
  return (
    <main className={styles.shell} data-recovery-scene={scene}>
      <div className={styles.stage}>
        <div className={styles.art} data-recovery-art aria-hidden="true" />
        <div className={styles.content}>
          <Suspense fallback={
            <section className="recovery-panel" aria-busy="true">
              <p className="recovery-kicker">Сенките</p>
              <h1>Зареждаме...</h1>
              <p className="recovery-copy" role="status">Изчакай малко.</p>
            </section>
          }>
            {children}
          </Suspense>
        </div>
      </div>
    </main>
  );
}

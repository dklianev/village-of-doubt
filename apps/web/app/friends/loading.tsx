import { SceneCard } from "@werewolf/ui/server";
import "@/components/friends/LegacyFriends.module.css";

export default function FriendsLoading() {
  return (
    <main className="shell utility-shell friends-shell framed-shell">
      <div className="framed-shell-inner" aria-busy="true" aria-label="Зареждане на гостовата книга">
        <header className="friends-hero friends-loading-hero">
          <SceneCard
            density="sm"
            background={{
              image: "var(--art-friends-social-hall)",
              overlay: "none",
              focalX: 52,
              focalY: 44,
              minHeight: "var(--friends-hero-height)",
            }}
          >
            <div className="friends-hero-copy">
              <p className="friends-kicker">познати на масата</p>
              <h1>Подготвяме масата.</h1>
              <p>Отваряме гостовата книга и подреждаме запазените места.</p>
            </div>
          </SceneCard>
        </header>

        <section className="friends-board friends-route-loading" aria-live="polite">
          <div className="friends-ledger-spine" aria-hidden>
            <span />
            <strong>Гостова книга</strong>
            <span />
          </div>
          <div className="friends-loading-layout" aria-hidden>
            <div className="friends-loading-form">
              <span className="friends-skeleton friends-skeleton-mark" />
              <span className="friends-skeleton friends-skeleton-title" />
              <span className="friends-skeleton friends-skeleton-field" />
              <span className="friends-skeleton friends-skeleton-field" />
              <span className="friends-skeleton friends-skeleton-action" />
            </div>
            <div className="friends-loading-list">
              <span className="friends-skeleton friends-skeleton-heading" />
              <span className="friends-skeleton friends-skeleton-row" />
              <span className="friends-skeleton friends-skeleton-row" />
              <span className="friends-skeleton friends-skeleton-row" />
            </div>
          </div>
          <p className="friends-loading-status">Зареждаме запазените места...</p>
        </section>
      </div>
    </main>
  );
}

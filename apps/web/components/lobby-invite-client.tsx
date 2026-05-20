"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Copy, Eye, Share2, Sparkles } from "lucide-react";
import type { GameFamily } from "@werewolf/shared";
import { useToast } from "@/lib/toast";

interface LobbyInviteClientProps {
  code: string;
  family: GameFamily;
  modeLabel: string;
  playHref: string;
  spectatorHref: string;
  hostName: string;
}

export function LobbyInviteClient({
  code,
  family,
  modeLabel,
  playHref,
  spectatorHref,
  hostName,
}: LobbyInviteClientProps) {
  const toast = useToast();

  const copyText = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ kind: "success", message });
    } catch {
      toast({ kind: "error", message: "Не успяхме да копираме. Опитай ръчно." });
    }
  };

  const shareInvite = async () => {
    const inviteUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Покана за частна стая",
          text: `Влез в моята стая с код ${code}`,
          url: inviteUrl,
        });
        return;
      }
      await copyText(inviteUrl, "Линкът за покана е копиран.");
    } catch {
      toast({ kind: "info", message: "Поканата остана при теб." });
    }
  };

  return (
    <article className="lobby-invite-v2" data-family={family}>
      <header className="lobby-invite-hero">
        <Image
          src="/game-art/legal/lobby-banner.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 1180px) 100vw, 1180px"
          className="lobby-invite-hero-img"
        />
        <div className="lobby-invite-hero-scrim" aria-hidden />
        <div className="lobby-invite-hero-copy">
          <p className="lobby-invite-kicker">частна стая · {modeLabel}</p>
          <h1>Покана за масата.</h1>
          <p>
            Сподели кода с играчите. Когато всички влязат, домакинът започва играта от общата
            стая.
          </p>
        </div>
      </header>

      <section className="lobby-code-panel" aria-labelledby="room-code-title">
        <div>
          <p className="lobby-code-label" id="room-code-title">
            Кодът на стаята
          </p>
          <div className="lobby-code-display" aria-label={`Код на стаята ${code}`}>
            {code}
          </div>
          <p className="lobby-code-help">Изпрати го на хората, които ще седнат на масата.</p>
        </div>

        <div className="lobby-code-actions" aria-label="Действия с поканата">
          <button type="button" className="btn btn-secondary" onClick={() => copyText(code, "Кодът е копиран.")}>
            <Copy aria-hidden strokeWidth={1.9} />
            <span>Копирай кода</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={shareInvite}>
            <Share2 aria-hidden strokeWidth={1.9} />
            <span>Сподели</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => copyText(window.location.href, "Линкът за покана е копиран.")}
          >
            <Sparkles aria-hidden strokeWidth={1.9} />
            <span>Копирай линка</span>
          </button>
        </div>
      </section>

      <nav className="lobby-invite-cta" aria-label="Действия за стаята">
        <Link href={playHref} className="btn btn-primary" prefetch={false}>
          Към играта
        </Link>
        <Link href={spectatorHref} className="btn btn-secondary" prefetch={false}>
          <Eye aria-hidden strokeWidth={1.9} />
          <span>Наблюдавай</span>
        </Link>
        <Link href="/lobby" className="btn btn-secondary" prefetch={false}>
          <ArrowLeft aria-hidden strokeWidth={1.9} />
          <span>Назад</span>
        </Link>
      </nav>

      <section className="lobby-route-card">
        <p className="lobby-route-kicker">Маршрут до площада</p>
        <p>
          {family === "werewolves"
            ? "Стаята е подготвена за нощни роли, дневно обсъждане и финален вот на селото."
            : "Стаята е подготвена за алибита, тайни действия и напрегнато гласуване."}
        </p>
      </section>

      <section className="lobby-player-preview" aria-label="Първи играчи в стаята">
        <p className="lobby-route-kicker">Първи места в стаята</p>
        <div className="lobby-player-preview-row">
          <span className="lobby-player-chip">
            <strong>{initialFor(hostName)}</strong>
            <span>{hostName}</span>
            <em>домакин</em>
          </span>
          <span className="lobby-player-chip is-empty">
            <strong>?</strong>
            <span>Очакваме играч</span>
            <em>място</em>
          </span>
          <span className="lobby-player-chip is-empty">
            <strong>?</strong>
            <span>Очакваме играч</span>
            <em>място</em>
          </span>
        </div>
      </section>
    </article>
  );
}

function initialFor(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase("bg-BG") || "И";
}

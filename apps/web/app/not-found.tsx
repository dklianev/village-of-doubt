import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, KeyRound } from "lucide-react";
import "@/components/system/NotFound.module.css";

export const metadata: Metadata = {
  title: "Тази страница липсва",
  description: "Адресът не води към страница. Върни се в Сенките или се присъедини с код.",
};

export default function NotFoundPage() {
  return (
    <main className="shell not-found-shell">
      <section className="not-found-scene" aria-labelledby="not-found-heading">
        <Image src="/game-art/system/missing-page-v1.webp" alt="" fill priority sizes="(max-width: 1240px) 100vw, 1180px" className="not-found-art" />
        <div className="not-found-copy">
          <p className="not-found-marker">404 <span>Липсваща страница</span></p>
          <h1 id="not-found-heading">Тази страница липсва.</h1>
          <p>Адресът може да е променен или изписан погрешно. Вечерта започва от друго място.</p>
          <div className="not-found-actions">
            <Link className="btn btn-primary" href="/" prefetch={false}>
              <ArrowLeft size={18} aria-hidden /> Към началото
            </Link>
            <Link className="not-found-join" href="/join" prefetch={false}>
              <KeyRound size={18} aria-hidden /> Имам код
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

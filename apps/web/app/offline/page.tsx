import Link from "next/link";

export const metadata = {
  title: "Няма връзка | Върколак и Мафия",
  description: "Екран без интернет връзка за Върколак и Мафия.",
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-28">
      <section className="mx-auto max-w-3xl rounded-[2.4rem] border border-[#f4e8d1]/20 bg-[#0b1114]/85 p-8 text-[#f4e8d1] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        <p className="section-kicker text-[#d19a42]">връзката прекъсна</p>
        <h1 className="mt-3 text-4xl font-black md:text-6xl">Играта чака интернет.</h1>
        <p className="mt-5 text-lg text-[#ead9ba]/80">
          Ако си бил в активна стая, не затваряй страницата. Когато връзката се върне, приложението ще опита да те
          върне към същото място.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/">
            Към началото
          </Link>
          <Link className="btn btn-secondary" href="/werewolf/rules">
            Прочети правилата
          </Link>
        </div>
      </section>
    </main>
  );
}

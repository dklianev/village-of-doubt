import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function SignInPage() {
  return (
    <main className="shell auth-shell">
      <section className="auth-stage">
        <div className="paper-card auth-card rounded-[2rem] p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[#842f2b]">вход</p>
          <h1 className="mt-3 text-5xl font-black leading-none">Влез в стаята</h1>
          <p className="mt-4 text-[#4f3829]">
            Профилът пази историята, статистиките и бъдещите публични стаи. За локални тестове
            играта още поддържа временна идентичност, но истинската маса започва оттук.
          </p>
          <AuthForm />
          <Link href="/" className="mt-6 inline-flex text-sm font-bold text-[#842f2b]">
            Назад към началото
          </Link>
        </div>

        <aside className="card auth-side rounded-[2rem] p-7">
          <p className="section-kicker">клетвата на масата</p>
          <h2 className="mt-3 text-4xl font-black leading-tight">Всички виждат площада. Само ти виждаш картата си.</h2>
          <p className="mt-5 text-[#ead9ba]">
            Auth-ът е входът към lobby, история и reconnect. Тайните роли пак не живеят в браузъра:
            game server-ът изпраща само това, което ти се полага.
          </p>
          <div className="auth-orbit" aria-hidden="true">
            <span className="role-art-tile role-priest">Свещеник</span>
            <span className="role-art-tile role-thief">Крадец</span>
            <span className="role-art-tile role-jester">Шут</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

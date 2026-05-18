"use client";

import { useState } from "react";

interface Commitment {
  id: string;
  number: number;
  title: string;
  promise: string;
  examplesOk: string[];
  examplesNotOk: string[];
}

const COMMITMENTS: readonly Commitment[] = [
  {
    id: "respect",
    number: 1,
    title: "Уважение към масата",
    promise: "Играй така, че всеки да си тръгне с желание да се върне следваща вечер.",
    examplesOk: [
      "Жесток блъф, който заблуждава селото — добре изиграна роля.",
      "Шумни обвинения по време на гласуване — част от драмата.",
      "Доволно подсмихване, когато планът ти проработи.",
    ],
    examplesNotOk: [
      "Лични обиди към играч, не към ролята му.",
      "Заплахи — реални или „на майтап“.",
      "Расистки, сексистки или хомофобски шеги.",
      "Преследване на играч след играта извън платформата.",
    ],
  },
  {
    id: "honor-in-play",
    number: 2,
    title: "Чест в играта",
    promise: "Лъжата на масата е разрешена и очаквана. Лъжата извън правилата — не.",
    examplesOk: [
      "Криеш ролята си от селото — част от играта.",
      "Лъжеш, че видя нечия карта — социална дедукция.",
      "Координираш с другите върколаци през частния чат.",
    ],
    examplesNotOk: [
      "Чийт ботове, autoclicker-и или други автоматизирани заявки.",
      "Дублиращи акаунти, за да гласуваш многократно.",
      "Споделяш ролята си извън стаята с играчи, които участват.",
      "Преглеждаш ходовете през развойни инструменти.",
    ],
  },
  {
    id: "private-data",
    number: 3,
    title: "Лично достойнство",
    promise: "Каквото е казано на масата, остава на масата. Хората са повече от ролите си.",
    examplesOk: [
      "Споменаваш на масата как си играл предишен ход.",
      "Показваш на приятел свой replay след играта.",
      "Споделяш статистика от профила си.",
    ],
    examplesNotOk: [
      "Споделяш чужд имейл, телефон или адрес.",
      "Публикуваш screenshot от чата с име на друг играч навън.",
      "Доксиш играч в социалните мрежи заради игра.",
      "Записваш и публикуваш разговори без съгласие.",
    ],
  },
  {
    id: "your-account",
    number: 4,
    title: "Своя профил",
    promise: "Профилът е твой — отговаряш за достъпа и за поведението му.",
    examplesOk: [
      "Споделяш код на стая с приятели за частна игра.",
      "Сменяш паролата си при подозрение.",
      "Сигнализираш ни, ако виждаш странна активност.",
    ],
    examplesNotOk: [
      "Споделяш парола с друг човек.",
      "Имитираш друг човек с подвеждащо име.",
      "Създаваш втори акаунт, за да заобиколиш ограничение.",
      "Купуваш или продаваш профили.",
    ],
  },
  {
    id: "age",
    number: 5,
    title: "Възраст",
    promise: "Минимум 13 години. Под 18 — със знанието на родител или настойник.",
    examplesOk: [
      "Играеш от 14-годишна възраст със съгласие на родителите.",
      "Гимназист в група за вечерта.",
      "Студент на 19 в стая с приятели.",
    ],
    examplesNotOk: [
      "Дете под 13 създава профил.",
      "Възрастен се представя за тийнейджър пред дете на масата.",
      "Възрастен умишлено търси непълнолетни извън рамките на игровата стая.",
    ],
  },
];

export function TermsCommitments() {
  const [openId, setOpenId] = useState<string | null>(COMMITMENTS[0]?.id ?? null);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <section className="terms-section">
      <header className="terms-section-head">
        <p className="terms-section-kicker">обещания</p>
        <h2>Пет обещания на масата.</h2>
        <p className="terms-section-lede">
          Не са правни клаузи. Са договорки между играчи — какво се прави и какво не.
        </p>
      </header>

      <ol className="terms-commitment-list">
        {COMMITMENTS.map((commitment) => {
          const isOpen = openId === commitment.id;
          return (
            <li key={commitment.id} className="terms-commitment-item" data-open={isOpen}>
              <button
                type="button"
                className="terms-commitment-handle"
                onClick={() => toggle(commitment.id)}
                aria-expanded={isOpen}
              >
                <span className="terms-commitment-num">{commitment.number}</span>
                <div className="terms-commitment-meta">
                  <h3>{commitment.title}</h3>
                  <p>{commitment.promise}</p>
                </div>
                <span className="terms-commitment-chevron" aria-hidden>
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen ? (
                <div className="terms-commitment-detail">
                  <div className="terms-examples-grid">
                    <div className="terms-examples terms-examples-ok">
                      <p className="terms-examples-label">Това е добре</p>
                      <ul>
                        {commitment.examplesOk.map((example) => (
                          <li key={example}>
                            <span className="terms-examples-icon" aria-hidden>
                              ✓
                            </span>
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="terms-examples terms-examples-not-ok">
                      <p className="terms-examples-label">Това не е добре</p>
                      <ul>
                        {commitment.examplesNotOk.map((example) => (
                          <li key={example}>
                            <span className="terms-examples-icon" aria-hidden>
                              ✕
                            </span>
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

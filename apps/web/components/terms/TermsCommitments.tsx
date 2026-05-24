"use client";

import { Display, PaperCard } from "@werewolf/ui";
import { useState } from "react";
import styles from "./TermsCommitments.module.css";

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
      "Споделяш статистика от досието си.",
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
    title: "Своето досие",
    promise: "Досието е твое — отговаряш за достъпа и за поведението му.",
    examplesOk: [
      "Споделяш код на стая с приятели за частна игра.",
      "Сменяш паролата си при подозрение.",
      "Сигнализираш ни, ако виждаш странна активност.",
    ],
    examplesNotOk: [
      "Споделяш парола с друг човек.",
      "Имитираш друг човек с подвеждащо име.",
      "Създаваш втори акаунт, за да заобиколиш ограничение.",
      "Купуваш или продаваш досиета.",
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
      "Дете под 13 създава досие.",
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
    <section className={`terms-section ${styles.commitmentsSection}`}>
      <PaperCard eyebrow="ОБЕЩАНИЯ" density="lg">
        <header className="terms-section-head">
          <Display as="h2" size="h3">
            Пет обещания на масата.
          </Display>
          <p className="terms-section-lede">
            Не са правни клаузи. Са договорки между играчи — какво се прави и какво не.
          </p>
        </header>

        <ol className={styles.commitmentList}>
          {COMMITMENTS.map((commitment) => {
            const isOpen = openId === commitment.id;
            return (
              <li key={commitment.id} className={styles.commitmentItem} data-open={isOpen}>
                <button
                  type="button"
                  className={styles.commitmentHandle}
                  onClick={() => toggle(commitment.id)}
                  aria-expanded={isOpen}
                >
                  <span className={styles.commitmentNum}>{commitment.number}</span>
                  <div className={styles.commitmentMeta}>
                    <h3>{commitment.title}</h3>
                    <p>{commitment.promise}</p>
                  </div>
                  <span className={styles.commitmentChevron} aria-hidden>
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen ? (
                  <div className={styles.commitmentDetail}>
                    <div className={styles.examplesGrid}>
                      <div className={`${styles.examples} ${styles.examplesOk}`}>
                        <p className={styles.examplesLabel}>Това е добре</p>
                        <ul>
                          {commitment.examplesOk.map((example) => (
                            <li key={example}>
                              <span className={styles.examplesIcon} aria-hidden>
                                ✓
                              </span>
                              <span>{example}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className={`${styles.examples} ${styles.examplesNotOk}`}>
                        <p className={styles.examplesLabel}>Това не е добре</p>
                        <ul>
                          {commitment.examplesNotOk.map((example) => (
                            <li key={example}>
                              <span className={styles.examplesIcon} aria-hidden>
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
      </PaperCard>
    </section>
  );
}

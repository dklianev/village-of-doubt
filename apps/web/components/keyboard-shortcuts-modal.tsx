"use client";

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  ["Space", "Пауза за host или Разказвач, когато играта не е паузирана и не е приключила."],
  ["Enter", "Потвърждава текущия глас или нощно действие, когато има избрана цел."],
  ["1-9", "Избира цел по ред в текущия панел: гласуване, нощно действие или изстрел на Ловеца."],
  ["Esc", "Затваря този прозорец или отменя текущата избрана цел."],
  ["?", "Отваря този лист с клавишни команди."],
] as const;

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <div className="shortcut-modal-backdrop" role="presentation" onClick={onClose}>
      <aside className="shortcut-modal" role="dialog" aria-label="Клавишни команди" onClick={(event) => event.stopPropagation()}>
        <button className="shortcut-modal-close" type="button" onClick={onClose}>
          затвори
        </button>
        <p className="section-kicker">клавиши</p>
        <h2>Команди от масата</h2>
        <p>
          Ползвай ги само когато екранът е пред теб. Сървърът пак решава дали действието е валидно.
        </p>
        <dl>
          {SHORTCUTS.map(([key, description]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}

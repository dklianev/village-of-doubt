"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeRoomCodeInput } from "@werewolf/shared";

type JoinCodeSlotsProps = {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
};

export function JoinCodeSlots({ value, onChange, invalid, autoFocus }: JoinCodeSlotsProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && !value) {
      refs.current[0]?.focus();
    }
  }, [autoFocus, value]);

  const setRef = (index: number) => (element: HTMLInputElement | null) => {
    refs.current[index] = element;
  };

  function updateSlot(index: number, rawValue: string) {
    const clean = rawValue
      .toUpperCase()
      .split("")
      .filter((character) => ROOM_CODE_ALPHABET.includes(character))
      .at(-1);

    const next = value.padEnd(ROOM_CODE_LENGTH, " ").split("");
    next[index] = clean ?? " ";
    onChange(next.join("").replace(/\s/g, "").slice(0, ROOM_CODE_LENGTH));

    if (clean && index < ROOM_CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
      refs.current[index + 1]?.select();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      event.preventDefault();
      const next = value.padEnd(ROOM_CODE_LENGTH, " ").split("");
      next[index - 1] = " ";
      onChange(next.join("").replace(/\s/g, "").slice(0, ROOM_CODE_LENGTH));
      refs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < ROOM_CODE_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const next = normalizeRoomCodeInput(event.clipboardData.getData("text"));
    if (!next) {
      return;
    }
    onChange(next);
    refs.current[Math.min(next.length, ROOM_CODE_LENGTH) - 1]?.focus();
  }

  return (
    <div className="join-codeslots" data-invalid={invalid ? "true" : undefined} role="group" aria-label="Код на стаята">
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={setRef(index)}
          className="join-codeslot"
          data-filled={value[index] ? "true" : undefined}
          maxLength={1}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          spellCheck={false}
          value={value[index] ?? ""}
          onChange={(event) => updateSlot(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          aria-label={`Символ ${index + 1} от ${ROOM_CODE_LENGTH}`}
        />
      ))}
    </div>
  );
}

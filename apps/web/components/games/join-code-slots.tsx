"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeRoomCodeInput } from "@werewolf/shared";

type JoinCodeSlotsProps = {
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
};

export function JoinCodeSlots({ value, onChange, invalid, describedBy, autoFocus }: JoinCodeSlotsProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && !value && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      refs.current[0]?.focus();
    }
  }, [autoFocus, value]);

  useEffect(() => {
    if (invalid) {
      refs.current[0]?.focus();
    }
  }, [invalid]);

  const setRef = (index: number) => (element: HTMLInputElement | null) => {
    refs.current[index] = element;
  };

  function updateSlot(index: number, rawValue: string) {
    if (rawValue.length >= ROOM_CODE_LENGTH) {
      const next = normalizeRoomCodeInput(rawValue);
      if (next) {
        onChange(next);
        refs.current[Math.min(next.length, ROOM_CODE_LENGTH - 1)]?.focus();
      }
      return;
    }
    const clean = rawValue
      .toUpperCase()
      .split("")
      .filter((character) => ROOM_CODE_ALPHABET.includes(character))
      .at(-1);

    const next = value.padEnd(ROOM_CODE_LENGTH, " ").split("");
    next[index] = clean ?? " ";
    if (rawValue && !clean) return;
    onChange(next.join("").trimEnd());

    if (clean && index < ROOM_CODE_LENGTH - 1) {
      refs.current[index + 1]?.focus();
      refs.current[index + 1]?.select();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const target = value[index]?.trim() ? index : Math.max(0, index - 1);
      const next = value.padEnd(ROOM_CODE_LENGTH, " ").split("");
      next[target] = " ";
      onChange(next.join("").trimEnd());
      refs.current[target]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
      refs.current[index - 1]?.select();
      return;
    }

    if (event.key === "ArrowRight" && index < ROOM_CODE_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
      refs.current[index + 1]?.select();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const next = normalizeRoomCodeInput(event.clipboardData.getData("text"));
    if (!next) {
      return;
    }
    onChange(next);
    refs.current[Math.min(next.length, ROOM_CODE_LENGTH - 1)]?.focus();
  }

  return (
    <div className="join-codeslots" data-invalid={invalid ? "true" : undefined} role="group" aria-label="Код на стаята">
      {Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={setRef(index)}
          className="join-codeslot"
          data-filled={value[index]?.trim() ? "true" : undefined}
          maxLength={ROOM_CODE_LENGTH}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          spellCheck={false}
          value={value[index]?.trim() ?? ""}
          onFocus={(event) => event.target.select()}
          onChange={(event) => updateSlot(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          aria-label={`Символ ${index + 1} от ${ROOM_CODE_LENGTH}`}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={describedBy}
        />
      ))}
    </div>
  );
}

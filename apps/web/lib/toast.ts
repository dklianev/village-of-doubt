"use client";

import { useEffect, useSyncExternalStore } from "react";

export type ToastKind = "info" | "error" | "success";

export interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

type ToastInput = {
  message: string;
  kind?: ToastKind;
};

const MAX_VISIBLE_TOASTS = 3;
const TOAST_TTL_MS = 4000;

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, number>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toasts;
}

function removeToast(id: string) {
  const timer = timers.get(id);
  if (timer) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function pushToast({ message, kind = "info" }: ToastInput) {
  if (typeof window === "undefined" || !message.trim()) {
    return;
  }

  const id = crypto.randomUUID();
  const item: ToastItem = { id, message: message.trim(), kind };
  toasts = [item, ...toasts].slice(0, MAX_VISIBLE_TOASTS);
  emit();

  const timer = window.setTimeout(() => removeToast(id), TOAST_TTL_MS);
  timers.set(id, timer);
}

export function useToast() {
  return pushToast;
}

export function useToastItems() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    return () => {
      if (listeners.size === 0) {
        for (const timer of timers.values()) {
          window.clearTimeout(timer);
        }
        timers.clear();
        toasts = [];
      }
    };
  }, []);

  return {
    items,
    dismiss: removeToast,
  };
}

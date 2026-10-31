"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createBrowserId } from "@/lib/browser-id";

export type ToastKind = "info" | "error" | "success" | "warning";
export type ToastPauseReason = "hover" | "focus";

export interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
  duration: number;
  paused: boolean;
}

type ToastInput = {
  message: string;
  kind?: ToastKind;
  duration?: number;
};

type ToastTimer = {
  handle: number | undefined;
  remaining: number;
  startedAt: number;
  pauses: Set<ToastPauseReason>;
};

const MAX_VISIBLE_TOASTS = 3;
const TOAST_TTL_MS = 4000;
// Errors usually carry the next step (a room code to retype, a retry), so they stay readable longer.
const ERROR_TOAST_TTL_MS = 8000;

let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ToastTimer>();

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

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer?.handle !== undefined) {
    window.clearTimeout(timer.handle);
  }
  timers.delete(id);
}

function startTimer(id: string, timer: ToastTimer) {
  timer.startedAt = Date.now();
  timer.handle = window.setTimeout(() => removeToast(id), timer.remaining);
}

function setPaused(id: string, paused: boolean) {
  toasts = toasts.map((item) => (item.id === id ? { ...item, paused } : item));
  emit();
}

function removeToast(id: string) {
  clearTimer(id);
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function pushToast({ message, kind = "info", duration }: ToastInput) {
  if (typeof window === "undefined" || !message.trim()) {
    return;
  }

  const id = createBrowserId("toast");
  const ttl = duration ?? (kind === "error" ? ERROR_TOAST_TTL_MS : TOAST_TTL_MS);
  const item: ToastItem = { id, message: message.trim(), kind, duration: ttl, paused: false };
  const next = [item, ...toasts];
  for (const dropped of next.slice(MAX_VISIBLE_TOASTS)) {
    clearTimer(dropped.id);
  }
  toasts = next.slice(0, MAX_VISIBLE_TOASTS);
  emit();

  const timer: ToastTimer = { handle: undefined, remaining: ttl, startedAt: 0, pauses: new Set() };
  timers.set(id, timer);
  startTimer(id, timer);
}

export function pauseToast(id: string, reason: ToastPauseReason) {
  const timer = timers.get(id);
  if (!timer || timer.pauses.has(reason)) return;
  timer.pauses.add(reason);
  if (timer.pauses.size > 1 || timer.handle === undefined) return;
  window.clearTimeout(timer.handle);
  timer.handle = undefined;
  timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
  setPaused(id, true);
}

export function resumeToast(id: string, reason: ToastPauseReason) {
  const timer = timers.get(id);
  if (!timer || !timer.pauses.delete(reason) || timer.pauses.size > 0) return;
  startTimer(id, timer);
  setPaused(id, false);
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
          if (timer.handle !== undefined) window.clearTimeout(timer.handle);
        }
        timers.clear();
        toasts = [];
      }
    };
  }, []);

  return {
    items,
    dismiss: removeToast,
    pause: pauseToast,
    resume: resumeToast,
  };
}

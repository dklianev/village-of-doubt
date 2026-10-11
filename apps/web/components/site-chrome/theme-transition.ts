export type ThemePreference = "light" | "dark";

export function createThemeTransition() {
  let pending: { preference: ThemePreference; transition?: ViewTransition } | undefined;

  function finish() {
    const change = pending;
    pending = undefined;
    change?.transition?.skipTransition();
    delete document.documentElement.dataset.vt;
    if (change) document.documentElement.dataset.theme = change.preference;
  }

  function apply(preference: ThemePreference, allowTransition = false) {
    finish();
    const root = document.documentElement;
    if (!allowTransition
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches
      || typeof document.startViewTransition !== "function") {
      root.dataset.theme = preference;
      return;
    }

    const change: NonNullable<typeof pending> = { preference };
    pending = change;
    const update = () => {
      // Skipping a transition still runs its callback; old clicks must not win.
      if (pending === change) root.dataset.theme = preference;
    };
    const settle = () => {
      if (pending !== change) return;
      root.dataset.theme = preference;
      delete root.dataset.vt;
      pending = undefined;
    };

    try {
      root.dataset.vt = "theme";
      const transition = document.startViewTransition(update);
      change.transition = transition;
      void transition.ready.catch(() => {});
      void transition.finished.then(settle, settle);
    } catch {
      finish();
    }
  }

  return { apply, finish };
}

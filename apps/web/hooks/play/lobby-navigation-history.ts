type NavigationEntry = { index: number };
type BrowserNavigation = EventTarget & { currentEntry: NavigationEntry | null };
type HistoryPosition = { index: number | null; href: string };
type HistoryGuard = { confirm: (() => boolean) | null; href: string };

export function samePage(from: string, to: string) {
  const source = new URL(from);
  const destination = new URL(to, source);
  return source.origin === destination.origin && source.pathname === destination.pathname && source.search === destination.search;
}

let historyGuard: HistoryGuard | undefined;

export function getHistoryGuard(): HistoryGuard {
  if (historyGuard) return historyGuard;
  const guard: HistoryGuard = { confirm: null, href: "" };
  historyGuard = guard;
  const candidate = (window as Window & { navigation?: BrowserNavigation }).navigation;
  const navigation = candidate?.currentEntry && typeof candidate.addEventListener === "function" ? candidate : undefined;
  const marker = "__lobbyNavigationGuard";
  let session = crypto.randomUUID();
  const nativeReplace = History.prototype.replaceState;
  const readIndex = (): number | null => {
    if (navigation) return navigation.currentEntry?.index ?? null;
    const value = window.history.state?.[marker];
    return value?.session === session && Number.isInteger(value.index) ? value.index : null;
  };
  let current: HistoryPosition = { index: readIndex(), href: window.location.href };
  let restoring: HistoryPosition | null = null;
  let recoveryTimer: number | undefined;
  let length = window.history.length;
  let currentState = window.history.state;

  const stamp = (index: number, state = window.history.state) => {
    // Add only our position, never replace Next's __NA/tree or rewrite its URL.
    nativeReplace.call(window.history, { ...state, [marker]: { session, index } }, "");
    current = { index, href: window.location.href };
    currentState = window.history.state;
    length = window.history.length;
  };
  const recover = (destination: HistoryPosition) => {
    if (!restoring) return;
    if (destination.index === restoring.index && destination.href === restoring.href) {
      current = restoring;
      restoring = null;
      return;
    }
    // Coalesce rapid traversals; calculate from the actual position when the
    // queued browser actions have run, not from the first rejected popstate.
    recoveryTimer = window.setTimeout(() => {
      const index = readIndex();
      if (restoring?.index != null && index !== null && restoring.index !== index) {
        window.history.go(restoring.index - index);
      }
    }, 0);
  };

  if (navigation) {
    // Use native indices, but one popstate cancellation path in every engine.
    // Cancelling navigate can leave Chromium's queued history.go relative to
    // the rejected destination instead of the entry still shown to the user.
    navigation.addEventListener("currententrychange", (event) => {
      const type = (event as Event & { navigationType: string }).navigationType;
      if (type !== "traverse") {
        // Native fragments otherwise have null state, so Next cannot restore
        // their route when returning from another page directly to that hash.
        if (type === "push" && window.history.state === null && currentState?.__NA && samePage(current.href, window.location.href)) {
          nativeReplace.call(window.history, currentState, "");
        }
        current = { index: readIndex(), href: window.location.href };
        currentState = window.history.state;
      }
    });
  } else {
    stamp(0);
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    window.history.pushState = function (...args: Parameters<History["pushState"]>) {
      const index = (current.index ?? -1) + 1;
      pushState.apply(this, args);
      if (current.index === null) session = crypto.randomUUID();
      stamp(index);
    };
    window.history.replaceState = function (...args: Parameters<History["replaceState"]>) {
      replaceState.apply(this, args);
      if (current.index !== null) stamp(current.index);
      else current.href = window.location.href;
    };
  }

  // instrumentation-client initializes this before Next installs its listener.
  // Window listeners run in registration order, regardless of capture.
  window.addEventListener("popstate", (event) => {
    const destination = { index: readIndex(), href: window.location.href };
    window.clearTimeout(recoveryTimer);
    // A growing stack proves this is a new native fragment, not an untagged
    // traversal. Carry the source router state, just as Next's Link would.
    if (!navigation && destination.index === null && current.index !== null && window.history.length > length && samePage(current.href, destination.href)) {
      stamp(current.index + 1, currentState);
      destination.index = current.index;
    }
    length = window.history.length;
    // Legacy history does not expose the direction/distance of untagged entries,
    // including pre-existing Forward entries. Fail open instead of faking a
    // cancellation, overwriting the destination, or trapping later traversals.
    if (destination.index === null || current.index === null) {
      restoring = null;
      current = destination;
      currentState = window.history.state;
      return;
    }
    if (restoring) {
      event.stopImmediatePropagation();
      recover(destination);
      return;
    }
    if (guard.confirm && samePage(guard.href, current.href) && !samePage(current.href, destination.href) && !guard.confirm()) {
      event.stopImmediatePropagation();
      restoring = current;
      recover(destination);
      return;
    }
    current = destination;
    currentState = window.history.state;
  }, true);
  return guard;
}

export function initializeLobbyNavigationGuard() {
  getHistoryGuard();
}

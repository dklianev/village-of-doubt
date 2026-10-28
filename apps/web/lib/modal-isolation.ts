type SavedAttributes = { inert: string | null; ariaHidden: string | null };

const layers: HTMLElement[] = [];
const isolated = new Map<HTMLElement, SavedAttributes>();

/**
 * Makes everything outside `layer` inert and hidden from assistive tech until the returned
 * release runs. Only the newest connected layer isolates, so stacked modals may close in any order.
 */
export function isolateModalLayer(layer: HTMLElement): () => void {
  layers.push(layer);
  syncIsolation();

  return () => {
    const index = layers.lastIndexOf(layer);
    if (index === -1) return;
    layers.splice(index, 1);
    syncIsolation();
  };
}

function syncIsolation() {
  const top = [...layers].reverse().find((layer) => layer.isConnected);
  const behind = new Set(top ? pageBehind(top) : []);

  for (const [element, saved] of isolated) {
    if (behind.has(element)) continue;
    restoreAttribute(element, "inert", saved.inert);
    restoreAttribute(element, "aria-hidden", saved.ariaHidden);
    isolated.delete(element);
  }

  for (const element of behind) {
    if (isolated.has(element)) continue;
    isolated.set(element, { inert: element.getAttribute("inert"), ariaHidden: element.getAttribute("aria-hidden") });
    element.setAttribute("inert", "");
    element.setAttribute("aria-hidden", "true");
  }
}

function pageBehind(layer: HTMLElement) {
  const behind: HTMLElement[] = [];

  for (let current = layer; current !== document.body && current.parentElement; current = current.parentElement) {
    for (const sibling of current.parentElement.children) {
      if (sibling === current || !(sibling instanceof HTMLElement) || /^(SCRIPT|STYLE|LINK)$/.test(sibling.tagName)) {
        continue;
      }
      // An open native dialog (e.g. lost room connection) owns the top layer; inert would leave nothing usable.
      if (sibling.matches("dialog[open]") || sibling.querySelector("dialog[open]")) continue;
      behind.push(sibling);
    }
  }

  return behind;
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

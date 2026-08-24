let fallbackSequence = 0;

export function createBrowserId(prefix = "client") {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const words = cryptoApi.getRandomValues(new Uint32Array(4));
    return `${prefix}-${Array.from(words, (word) => word.toString(16).padStart(8, "0")).join("")}`;
  }

  fallbackSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackSequence.toString(36)}`;
}

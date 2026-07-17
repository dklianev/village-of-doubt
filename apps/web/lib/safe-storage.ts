type StorageKind = "localStorage" | "sessionStorage";

export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
  getJson<T>(key: string): T | null;
  setJson(key: string, value: unknown): boolean;
}

function resolveStorage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[kind];
  } catch {
    return null;
  }
}

function createSafeStorage(kind: StorageKind): SafeStorage {
  return {
    getItem(key) {
      try {
        return resolveStorage(kind)?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        const storage = resolveStorage(kind);
        if (!storage) {
          return false;
        }
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        const storage = resolveStorage(kind);
        if (!storage) {
          return false;
        }
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
    getJson<T>(key: string): T | null {
      const value = this.getItem(key);
      if (value === null) {
        return null;
      }

      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },
    setJson(key, value) {
      try {
        return this.setItem(key, JSON.stringify(value));
      } catch {
        return false;
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");

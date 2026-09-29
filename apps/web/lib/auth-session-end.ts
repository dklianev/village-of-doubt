import { createBrowserId } from "./browser-id";
import { safeLocalStorage } from "./safe-storage";
import { leaveAuthenticatedDocument, LOGOUT_REVISION_KEY } from "./auth-session-document";

export function endAuthSession() {
  if (!safeLocalStorage.setItem(LOGOUT_REVISION_KEY, createBrowserId("logout"))) {
    safeLocalStorage.removeItem(LOGOUT_REVISION_KEY);
  }
  window.dispatchEvent(new Event("auth-session-change"));
  leaveAuthenticatedDocument();
}

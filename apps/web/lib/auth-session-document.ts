import "./auth-session-end.css";

export const LOGOUT_REVISION_KEY = "auth-logout-revision";

export function leaveAuthenticatedDocument() {
  if (document.getElementById("auth-session-ended")) return;

  // This document is terminal. Cover portals as well as React's cached pages,
  // and take native modality so an old focus trap cannot block the home link.
  for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog[open]")) dialog.close();
  // Fixed markup only: no session or user data belongs in this document cover.
  document.body.insertAdjacentHTML("beforeend",
    '<dialog id="auth-session-ended" role="alertdialog" aria-label="Сесията ти е приключила" aria-live="assertive">'
    + '<h1>Сесията ти е приключила</h1><a href="/">Към началото</a></dialog>');
  const notice = document.getElementById("auth-session-ended") as HTMLDialogElement;
  notice.addEventListener("cancel", (event) => event.preventDefault());
  notice.showModal();
  notice.querySelector<HTMLAnchorElement>("a")!.focus();
  window.location.replace("/");
}

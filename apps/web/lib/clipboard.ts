export async function copyTextToClipboard(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to selection-based copy below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard copy failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

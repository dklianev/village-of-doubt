export async function assertInteractiveTouchTargets(page, label) {
  const failures = await page.evaluate(() => {
    const selector = 'button, a, input, select, textarea, summary, [role="button"]';
    function visible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return !element.closest('[inert], [aria-hidden="true"]')
        && style.visibility !== "hidden" && style.display !== "none"
        && rect.width > 0 && rect.height > 0;
    }
    return Array.from(document.querySelectorAll(selector))
      .filter(visible)
      .map((element) => {
        let rect = element.getBoundingClientRect();
        // Native labels activate radio/checkbox controls, including visually hidden inputs.
        if (element instanceof HTMLInputElement && /^(radio|checkbox)$/.test(element.type)) {
          for (const label of element.labels ?? []) {
            const style = window.getComputedStyle(label);
            if (!visible(label) || style.pointerEvents === "none" || Number(style.opacity) === 0) continue;
            const target = label.getBoundingClientRect();
            if (target.width >= 28 && target.height >= 28) { rect = target; break; }
          }
        }
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.width < 28 || item.height < 28)
      .slice(0, 12);
  });
  if (failures.length > 0) {
    throw new Error(`${label} has cramped interactive targets:\n${JSON.stringify(failures, null, 2)}`);
  }
}

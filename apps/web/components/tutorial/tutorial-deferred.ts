export function loadTutorialDeferredSlide() {
  // Start a new import on retry; do not retain a rejected lazy component/promise.
  return import("./TutorialDeferredSlide").then((module) => module.TutorialDeferredSlide);
}

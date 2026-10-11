export function loadCreateCustomizationContent() {
  // A retry starts a fresh import instead of retaining a rejected React.lazy promise.
  return import("./CreateCustomizationContent").then((module) => module.CreateCustomizationContent);
}

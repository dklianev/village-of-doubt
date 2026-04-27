const tabs = document.querySelectorAll("[data-screen]");
const panels = document.querySelectorAll("[data-screen-panel]");

function activateScreen(screen) {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.screen === screen);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.screenPanel === screen);
  });

  if (window.location.hash.slice(1) !== screen) {
    history.replaceState(null, "", `#${screen}`);
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateScreen(tab.dataset.screen));
});

const initialScreen = window.location.hash.slice(1);
const hasInitialScreen = [...tabs].some((tab) => tab.dataset.screen === initialScreen);

if (hasInitialScreen) {
  activateScreen(initialScreen);
}

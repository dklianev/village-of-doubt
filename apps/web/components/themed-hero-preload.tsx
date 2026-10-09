type HeroScene = "werewolf" | "mafia" | "sign-in";

// Resolve the saved theme before background-image discovery. This is a document
// hint; client navigation discovers the artwork through CSS without extra JS.
export function ThemedHeroPreload({ scene }: { scene: HeroScene }) {
  const auth = scene === "sign-in";
  const family = scene === "mafia" ? "mafia" : "werewolf";
  const script = `(() => {
    const mobile = matchMedia('(max-width: ${auth ? 800 : 720}px)').matches;
    const compact = ${auth ? "false" : "matchMedia('(max-width: 480px) and (max-resolution: 1.75dppx)').matches"};
    const light = document.documentElement.dataset.theme === 'light';
    const version = ${auth ? "light ? 'light-v2' : 'dark-v2'" : "light ? 'light-v1' : mobile ? 'v3' : 'v2'"};
    const href = '/game-art/' + (mobile ? 'mobile/' : '') + '${auth ? "auth/bg-sign-in-" : `${family}/bg-hero-`}' + version + (compact ? '-864' : '') + '.avif';
    if ([...document.head.querySelectorAll('link[rel="preload"][as="image"]')].some(link => link.getAttribute('href') === href)) return;
    const link = document.createElement('link');
    link.rel = 'preload'; link.setAttribute('as', 'image'); link.type = 'image/avif'; link.fetchPriority = 'high'; link.href = href;
    document.head.appendChild(link);
  })();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

const preset = process.env.LIGHTHOUSE_PROFILE ?? "mobile";
if (!["desktop", "mobile"].includes(preset)) {
  throw new Error(`LIGHTHOUSE_PROFILE must be desktop or mobile; received ${preset}.`);
}

const port = process.env.LHCI_PORT ?? "3410";
const baseUrl = `http://127.0.0.1:${port}`;
const isDesktop = preset === "desktop";

module.exports = {
  ci: {
    collect: {
      startServerCommand: "node scripts/lighthouse-server.mjs",
      startServerReadyPattern: "Ready in|Ready on|Local:",
      startServerReadyTimeout: 60_000,
      url: [
        `${baseUrl}/`,
        `${baseUrl}/werewolf`,
        `${baseUrl}/tutorial`,
        `${baseUrl}/werewolf/rules`,
        `${baseUrl}/mafia/rules`,
        `${baseUrl}/faq`,
        `${baseUrl}/sign-in`,
      ],
      numberOfRuns: 3,
      settings: isDesktop
        ? {
            formFactor: "desktop",
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1,
              disabled: false,
            },
            throttling: {
              rttMs: 40,
              throughputKbps: 10_240,
              cpuSlowdownMultiplier: 1,
              requestLatencyMs: 0,
              downloadThroughputKbps: 0,
              uploadThroughputKbps: 0,
            },
          }
        : {},
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: isDesktop ? 0.85 : 0.75 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: isDesktop ? 3000 : 4000 }],
        "total-blocking-time": ["error", { maxNumericValue: isDesktop ? 300 : 500 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: process.env.LHCI_OUTPUT_DIR ?? `output/lighthouse/${preset}`,
    },
  },
};

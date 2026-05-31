# Codex prompt — Pre-launch test coverage (без a11y)

Целта: подготовка на test suite-а за публично пускане. Покрива 10 слоя:
unit gaps, integration extras, component tests, API contract tests, E2E auth flows,
visual regression baseline, performance budgets, load tests, migration tests, и
обновяване на CI verify chain. **Без accessibility работа** по изрично искане.

---

## Prompt (paste below)

You are working in the **werewolf_mafia** monorepo (pnpm 10 + Turbo, Next.js 16 App Router + React 19 + Tailwind 4, Colyseus 0.17 game server, PostgreSQL + Drizzle, Better Auth 1.6, Vitest 4). Read `AGENTS.md` first — invariants:
- Всичкият user-facing copy на български. Test descriptions могат да са на български или английски — но error messages и debug output към user-а трябва да са БГ.
- **Без accessibility tests** — user-ът изрично каза без a11y работа.
- Не пипай game-server core logic; само тествай я.
- Минимални нови npm dependencies — само за testing infrastructure, които ще обяснявам.

### Контекст: какво вече има

| Layer | Файлове |
|---|---|
| **Unit** | `packages/shared/src/__tests__/{game-token,achievements,win-conditions,game-config}.test.ts`, `apps/web/lib/__tests__/{room-options,sound,history-highlights,leaderboard-headlines}.test.ts`, `apps/game-server/src/game-logic/__tests__/night-resolver.test.ts` |
| **Integration** | `apps/game-server/src/__tests__/{GameRoom.regression,GameRoom.security}.test.ts` |
| **Smoke** | `scripts/smoke.mjs` |
| **Frontend E2E** | `scripts/frontend-e2e.mjs` |
| **Playtest** | `scripts/playtest.mjs` |
| **Regression contracts** | `scripts/regression.mjs` |
| **Typecheck** | `turbo typecheck` |
| **Verify chain** | `pnpm verify` (optimize:assets → regression → typecheck → build → smoke → frontend:e2e → playtest → test) |

Vitest 4 е runner-ът; Playwright 1.59 е там; @colyseus/testing се ползва за room integration.

---

## Стъпка 1 — Testing dependencies (justified additions)

Добави следните **dev dependencies** в съответните `package.json`:

### `apps/web/package.json` → devDependencies
- `@testing-library/react@^16`
- `@testing-library/user-event@^14`
- `@testing-library/jest-dom@^6`
- `jsdom@^25`

### Root `package.json` → devDependencies
- `@colyseus/loadtest@^0.16` (за стъпка 9)

Те са **само за тестване** — не отиват в production bundle. Документирай решението в short comment в commit-а: "Тестови deps; не influence-ват production bundle."

### Vitest конфигурация за component tests

Създай `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.tsx",
      "app/**/*.test.tsx",
    ],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Създай `apps/web/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

---

## Стъпка 2 — Unit test gaps

Добави следните test файла:

### `packages/shared/src/__tests__/role-assignment.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { assignRoles } from "../role-assignment.js"; // adjust import to actual symbol
import { getWerewolvesClassicPreset } from "../game-config.js";

describe("assignRoles", () => {
  it("е детерминистично при еднакъв seed", () => {
    const preset = getWerewolvesClassicPreset(8);
    const users = ["u1","u2","u3","u4","u5","u6","u7","u8"];
    const a = assignRoles(users, preset, { seed: "fixed-seed" });
    const b = assignRoles(users, preset, { seed: "fixed-seed" });
    expect(a).toEqual(b);
  });

  it("дава различни резултати при различен seed", () => {
    const preset = getWerewolvesClassicPreset(8);
    const users = ["u1","u2","u3","u4","u5","u6","u7","u8"];
    const a = assignRoles(users, preset, { seed: "seed-a" });
    const b = assignRoles(users, preset, { seed: "seed-b" });
    expect(a).not.toEqual(b);
  });

  it("уникално присвоява роля на всеки играч", () => {
    const preset = getWerewolvesClassicPreset(10);
    const users = Array.from({ length: 10 }, (_, i) => `user-${i}`);
    const result = assignRoles(users, preset);
    expect(Object.keys(result)).toHaveLength(10);
    expect(new Set(Object.keys(result))).toEqual(new Set(users));
  });

  it("пази баланса селяни/върколаци според preset", () => {
    const preset = getWerewolvesClassicPreset(10);
    const users = Array.from({ length: 10 }, (_, i) => `user-${i}`);
    const result = assignRoles(users, preset);
    const werewolves = Object.values(result).filter((role) => role === "werewolf").length;
    expect(werewolves).toBe(preset.werewolfCount);
  });

  it("хвърля грешка при по-малко играчи от minPlayers", () => {
    const preset = getWerewolvesClassicPreset(8);
    expect(() => assignRoles(["u1","u2"], preset)).toThrow();
  });
});
```

**Codex**: ако `role-assignment.ts` не expose-ва `assignRoles` директно, провери файла за актуалния named export и адаптирай тестовете. Запази смисъла, не имена на функции.

### `packages/shared/src/__tests__/phase-vocabulary.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { phaseLabelBg } from "../phase-vocabulary.js";

describe("phaseLabelBg", () => {
  it("връща werewolf-specific label за werewolves_classic", () => {
    expect(phaseLabelBg("night", "werewolves_classic")).toBe("Нощ");
    expect(phaseLabelBg("first_night", "werewolves_classic")).toMatch(/Първа нощ/);
  });

  it("връща mafia-specific label за mafia_sport", () => {
    const result = phaseLabelBg("night", "mafia_sport");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("връща различни labels за night между семействата", () => {
    const werewolfLabel = phaseLabelBg("night", "werewolves_classic");
    const mafiaLabel = phaseLabelBg("night", "mafia_free");
    // и двете трябва да са на БГ; може да са различни или еднакви, но не и празни
    expect(werewolfLabel).toBeTruthy();
    expect(mafiaLabel).toBeTruthy();
  });

  it("връща fallback за непознатa phase", () => {
    expect(phaseLabelBg("unknown_phase" as never, "werewolves_classic")).toBeTruthy();
  });
});
```

### Разшири `packages/shared/src/__tests__/game-token.test.ts`

Добави нови test cases в съществуващия файл:

```ts
describe("game-token security", () => {
  it("отказва token с подправен payload", () => {
    const token = createGameToken({ userId: "u1", displayName: "Анна", roomCode: "ABC123", secret: "s" });
    const parts = token.split(".");
    parts[0] = Buffer.from(JSON.stringify({ userId: "hacker", displayName: "Hacker", roomCode: "ABC123", exp: Date.now() + 60000 })).toString("base64url");
    const tampered = parts.join(".");
    expect(() => verifyGameToken(tampered, { roomCode: "ABC123", secret: "s" })).toThrow();
  });

  it("отказва expired token", () => {
    // ако createGameToken приема expSeconds, използвай я с отрицателно число
    const token = createGameToken({ userId: "u1", displayName: "Анна", roomCode: "ABC123", secret: "s", expSeconds: -10 });
    expect(() => verifyGameToken(token, { roomCode: "ABC123", secret: "s" })).toThrow(/изтек/i);
  });

  it("отказва token за грешна стая", () => {
    const token = createGameToken({ userId: "u1", displayName: "Анна", roomCode: "ABC123", secret: "s" });
    expect(() => verifyGameToken(token, { roomCode: "OTHER1", secret: "s" })).toThrow();
  });

  it("отказва token с грешен secret", () => {
    const token = createGameToken({ userId: "u1", displayName: "Анна", roomCode: "ABC123", secret: "s" });
    expect(() => verifyGameToken(token, { roomCode: "ABC123", secret: "wrong-secret" })).toThrow();
  });
});
```

---

## Стъпка 3 — Integration test extras (game-server)

Добави в `apps/game-server/src/__tests__/`:

### `GameRoom.reconnect.test.ts`

Сценарий: играч присъединил стая, играта стартирала, играчът disconnect-ва насред нощ, после reconnect-ва. Verify:
1. State се възстановява (същата роля).
2. Ролята му **не е leak-ната** на другите играчи в `state.players`.
3. `publicEvents` запазват reconnect collision event.
4. След reconnect, играчът може да изпрати night action.

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { createGameToken } from "@werewolf/shared/server";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";

const SECRET = "test-secret-that-is-long-enough-32-chars";

describe("GameRoom reconnect resilience", () => {
  let colyseus: ColyseusTestServer;
  let envBackup: Record<string, string | undefined>;

  beforeEach(async () => {
    envBackup = {
      GAME_TOKEN_SECRET: process.env.GAME_TOKEN_SECRET,
      ALLOW_DEV_AUTH: process.env.ALLOW_DEV_AUTH,
      NODE_ENV: process.env.NODE_ENV,
    };
    process.env.GAME_TOKEN_SECRET = SECRET;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2680);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    Object.entries(envBackup).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  it("възстановява state на играч след reconnect, без да leak-не ролята", async () => {
    // (Codex: write the full scenario — 8 players, start game, disconnect player 3 mid-night, reconnect, verify private_role re-sent to player 3 only, public state.players[3] няма role field, reconnect collision event е записан в publicEvents)
  });
});
```

**Codex**: dispatch-ва тест в стил на `GameRoom.security.test.ts` — boot Colyseus, connect 8 клиенти, изиграй до първа нощ, симулирай disconnect (`client.leave()`), reconnect (`colyseus.connectTo(room, ...)`) и assert на state-а.

### `GameRoom.full-night.test.ts`

Пълен 8-играчен flow от lobby до game_over:
1. 8 играчи се присъединяват.
2. Host пуска `startGame`.
3. Всеки получава `private_role`.
4. Първа нощ → werewolves избират target, healer (ако е) спасява, seer (ако е) проверява.
5. Day announcement → death revealed.
6. Day discussion → vote.
7. Resolution → ако werewolves печелят, проверка на `winnerTeam === "werewolves"`.
8. `state.phase === "game_over"`.

Това е "happy path" smoke за гражданския цикъл.

### `GameRoom.mayor-succession.test.ts`

Сценарий: текущ кмет умира → `pendingMayorSuccessor` flag се вдига → next vote determine-ва new mayor → double vote works after.

### `GameRoom.race-conditions.test.ts`

Двама играчи изпращат night action едновременно за един и същ target. Очаквай: server resolve-ва deterministically, един action wins, другият получава safe_error.

---

## Стъпка 4 — Component tests (React UI)

Setup-ът от Стъпка 1 е завършен. Сега 5 ключови компонента:

### `apps/web/components/lobby/__tests__/LobbyWizard.test.tsx`

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LobbyWizard } from "../LobbyWizard";

describe("LobbyWizard", () => {
  it("показва 4 стъпки", () => {
    render(<LobbyWizard family="werewolves" />);
    expect(screen.getByText("Стая")).toBeInTheDocument();
    expect(screen.getByText("Роли")).toBeInTheDocument();
    expect(screen.getByText("Стил")).toBeInTheDocument();
    expect(screen.getByText("Преглед")).toBeInTheDocument();
  });

  it("навигира Напред/Назад между стъпките", async () => {
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByRole("button", { name: /Назад/ })).toBeEnabled();
  });

  it("валидира името на стаята", async () => {
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);
    const input = screen.getByLabelText(/име на стаята/i);
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    // Очакваме error message
    expect(screen.getByText(/име/i)).toBeInTheDocument();
  });
});
```

### `apps/web/components/sign-in/__tests__/OAuthButton.test.tsx`

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OAuthButton } from "../OAuthButton";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  },
}));

describe("OAuthButton", () => {
  it("показва Google label при provider=google", () => {
    render(<OAuthButton provider="google" redirectTo="/" />);
    expect(screen.getByText(/Продължи с Google/i)).toBeInTheDocument();
  });

  it("показва Discord label при provider=discord", () => {
    render(<OAuthButton provider="discord" redirectTo="/" />);
    expect(screen.getByText(/Продължи с Discord/i)).toBeInTheDocument();
  });

  it("извиква authClient.signIn.social при click", async () => {
    const { authClient } = await import("@/lib/auth-client");
    const user = userEvent.setup();
    render(<OAuthButton provider="google" redirectTo="/play/ABC" />);
    await user.click(screen.getByRole("button"));
    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/play/ABC",
    });
  });
});
```

### `apps/web/components/site-chrome/__tests__/AuthChip.test.tsx`

Mock `authClient.useSession()` за двата state:
1. `data: null, isPending: false` → показва "Влез →" link към `/sign-in`.
2. `data: { user: { name: "Анна", image: "..." } }, isPending: false` → показва avatar + name + chevron, и click отваря dropdown с 4 menu items.

### `apps/web/components/tutorial/__tests__/DayClueChips.test.tsx`

```tsx
describe("DayClueChips", () => {
  it("показва 5 face-down chip-а", () => {
    render(<DayClueChips />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("flip-ва chip-а на click и показва clue", async () => {
    const user = userEvent.setup();
    render(<DayClueChips />);
    const annaButton = screen.getByLabelText(/Разкрий Анна/);
    await user.click(annaButton);
    expect(screen.getByText(/Говори спокойно/)).toBeInTheDocument();
  });

  it("брои посетените chips", async () => {
    const user = userEvent.setup();
    render(<DayClueChips />);
    expect(screen.getByText(/посетени: 0/)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Разкрий Анна/));
    expect(screen.getByText(/посетени: 1/)).toBeInTheDocument();
  });
});
```

### `apps/web/components/leaderboard/__tests__/MainHeadline.test.tsx`

Тест на headline generation за различни entry profiles:
- `wins == games && games >= 5` → "{name} още не познава поражение"
- `games == 1 && wins == 1` → "Първа победа..."
- Дефолтен fallback.

---

## Стъпка 5 — API contract tests

Тестове за Next.js API routes без реален HTTP — викай `POST` функцията директно с mock `Request`.

### `apps/web/app/api/game-token/__tests__/route.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("POST /api/game-token", () => {
  it("отказва без сесия", async () => {
    const { auth } = await import("@/lib/auth");
    (auth.api.getSession as any).mockResolvedValue(null);

    const request = new Request("http://localhost/api/game-token", {
      method: "POST",
      body: JSON.stringify({ code: "ABC123" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("отказва празен room code", async () => {
    const { auth } = await import("@/lib/auth");
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "user-1", name: "Анна" },
    });

    const request = new Request("http://localhost/api/game-token", {
      method: "POST",
      body: JSON.stringify({ code: "" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("издава token при валидна сесия + room code", async () => {
    process.env.GAME_TOKEN_SECRET = "test-secret-that-is-long-enough-32-chars";
    process.env.NODE_ENV = "test";

    const { auth } = await import("@/lib/auth");
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "user-1", name: "Анна" },
    });

    const request = new Request("http://localhost/api/game-token", {
      method: "POST",
      body: JSON.stringify({ code: "ABC123" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.token).toBeTruthy();
    expect(body.userId).toBe("user-1");
    expect(body.displayName).toBe("Анна");
  });
});
```

### `apps/web/app/api/achievements/__tests__/route.test.ts`

Тества GET endpoint-а — връща правилни постижения за user, празно за непознат.

### `apps/web/app/api/account/delete/__tests__/route.test.ts`

Тества account deletion:
- 401 без сесия
- 200 + cascade delete при валидна сесия (mock-ва `auth.api.deleteUser` или Drizzle delete query)

---

## Стъпка 6 — E2E auth flows (Playwright)

Разшири текущия `scripts/frontend-e2e.mjs` или създай нов `scripts/e2e-auth.mjs`. Препоръчвам **нов файл** — auth flow-овете изискват database state, а текущият e2e тества само UI render.

### `scripts/e2e-auth.mjs`

```js
import { chromium } from "playwright";
import { spawn } from "node:child_process";
// (boot web + game-server with mock Google OAuth callback, например чрез OAUTH_MOCK=true env var)

const scenarios = [
  {
    name: "auth gate redirect",
    run: async (page) => {
      await page.goto("http://localhost:3000/werewolf/create");
      // очакваме redirect към /sign-in?redirect=...
      await page.waitForURL(/\/sign-in\?redirect=/);
      const url = new URL(page.url());
      const redirect = url.searchParams.get("redirect");
      if (redirect !== "/werewolf/create") {
        throw new Error(`Ожаквах redirect=/werewolf/create, получих ${redirect}`);
      }
    },
  },
  {
    name: "email + password registration",
    run: async (page) => {
      await page.goto("http://localhost:3000/sign-in");
      await page.click('button:has-text("Нов профил")');
      await page.fill('input[type="email"]', `test-${Date.now()}@local.invalid`);
      await page.fill('input[type="password"]', "Test1234!");
      await page.click('button[type="submit"]');
      await page.waitForURL("http://localhost:3000/");
      // navbar показва avatar/име
      await page.waitForSelector('.auth-chip-avatar', { timeout: 5000 });
    },
  },
  {
    name: "full game flow с 2 клиента",
    run: async (browser) => {
      // (Codex: реално сложен сценарий — два контекста, login и двата, host create + join, expect и двата вижат същия player count, и т.н.)
    },
  },
  {
    name: "reconnect след disconnect",
    run: async (browser) => {
      // create context, login, join room, start game, close context, reopen, navigate /play/CODE, очаквай restored state
    },
  },
  {
    name: "account deletion flow",
    run: async (page) => {
      // create user → login → /account → click "Изтрий профила" → confirm → redirect to / → user няма session
    },
  },
];

for (const scenario of scenarios) {
  console.log(`▶ ${scenario.name}`);
  const browser = await chromium.launch();
  try {
    if (scenario.run.length === 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await scenario.run(page);
    } else {
      await scenario.run(browser);
    }
    console.log(`✓ ${scenario.name}`);
  } catch (error) {
    console.error(`✗ ${scenario.name}:`, error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
```

### Mock OAuth callback

За да не зависиш от real Google, добави dev-only middleware в `apps/web/app/api/auth/[...all]/route.ts` (или в env-gated branch на Better Auth config):

Когато `OAUTH_MOCK=true`, всеки callback за `provider=google` или `provider=discord` връща mocked user:
```
{ id: "mock-google-1", email: "test@local.invalid", name: "Тест", image: "" }
```

**Critical**: този mock се enable-ва **само** при `OAUTH_MOCK === "true"`, и `regression.mjs` трябва да assert-не, че `OAUTH_MOCK` не е активен в production build (по модел на `ALLOW_DEV_AUTH` guard).

Добави това в `pnpm verify` chain — нов script `pnpm e2e:auth` или append към съществуващия `pnpm frontend:e2e`.

---

## Стъпка 7 — Visual regression baseline

Playwright поддържа native screenshot comparison чрез `expect(page).toHaveScreenshot()`. Зависимостта вече е там.

### `apps/web/__visual__/visual-regression.spec.ts`

```ts
import { expect, test } from "@playwright/test";

const ROUTES = [
  { name: "home", path: "/" },
  { name: "werewolf-home", path: "/werewolf" },
  { name: "mafia-home", path: "/mafia" },
  { name: "werewolf-roles", path: "/werewolf/roles" },
  { name: "werewolf-rules", path: "/werewolf/rules" },
  { name: "tutorial-1", path: "/tutorial?step=1" },
  { name: "tutorial-2", path: "/tutorial?step=2" },
  { name: "tutorial-3", path: "/tutorial?step=3" },
  { name: "tutorial-4", path: "/tutorial?step=4" },
  { name: "tutorial-5", path: "/tutorial?step=5" },
  { name: "tutorial-6", path: "/tutorial?step=6" },
  { name: "sign-in", path: "/sign-in" },
  { name: "history-empty", path: "/history" },
  { name: "leaderboard-empty", path: "/leaderboard" },
  { name: "achievements-locked", path: "/achievements" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${viewport.name} ${route.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`http://localhost:3000${route.path}`);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${viewport.name}-${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.002, // 0.2% tolerance за font rendering quirks
      });
    });
  }
}
```

### `playwright.config.ts` (нов файл в root или apps/web/)

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/__visual__",
  outputDir: "./test-results/visual",
  snapshotDir: "./apps/web/__visual__/__baseline__",
  use: {
    baseURL: "http://localhost:3000",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: "disabled",
    },
  },
});
```

### Първоначално baseline-ване

Стартирай:
```bash
pnpm playwright test --update-snapshots
```

Това създава baseline PNG в `apps/web/__visual__/__baseline__/`. Commit-ни ги в repo-то (те са guardrail-а; всеки следващ run сравнява срещу тях).

### Нов npm script

В root `package.json`:
```json
"visual": "playwright test --config=playwright.config.ts",
"visual:update": "playwright test --config=playwright.config.ts --update-snapshots"
```

---

## Стъпка 8 — Performance budgets

### `scripts/bundle-budget.mjs`

```js
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const BUDGETS = {
  totalJsKb: 220,
  totalCssKb: 70,
  largestRouteKb: 90,
  largestArtAssetKb: 800,
};

function fileSizeKb(filePath) {
  return Math.round((statSync(filePath).size / 1024) * 10) / 10;
}

function listGzippedSize(dir, exts) {
  // (Codex: walk dir, filter by exts, sum sizes, optional gzip via zlib)
  let total = 0;
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (exts.some((ext) => entry.name.endsWith(ext))) {
        total += fileSizeKb(full);
      }
    }
  }
  walk(dir);
  return total;
}

const failures = [];

const jsDir = "apps/web/.next/static/chunks";
if (existsSync(jsDir)) {
  const totalJs = listGzippedSize(jsDir, [".js"]);
  if (totalJs > BUDGETS.totalJsKb) failures.push(`Total JS ${totalJs} KB > budget ${BUDGETS.totalJsKb} KB`);
  console.log(`Total JS: ${totalJs} KB (budget: ${BUDGETS.totalJsKb} KB)`);
}

const cssDir = "apps/web/.next/static/css";
if (existsSync(cssDir)) {
  const totalCss = listGzippedSize(cssDir, [".css"]);
  if (totalCss > BUDGETS.totalCssKb) failures.push(`Total CSS ${totalCss} KB > budget ${BUDGETS.totalCssKb} KB`);
  console.log(`Total CSS: ${totalCss} KB (budget: ${BUDGETS.totalCssKb} KB)`);
}

const artDir = "apps/web/public/game-art";
if (existsSync(artDir)) {
  const largest = readdirSync(artDir)
    .filter((f) => f.endsWith(".webp") || f.endsWith(".png"))
    .map((f) => ({ name: f, size: fileSizeKb(path.join(artDir, f)) }))
    .sort((a, b) => b.size - a.size)[0];
  if (largest && largest.size > BUDGETS.largestArtAssetKb) {
    failures.push(`Largest art asset ${largest.name} ${largest.size} KB > budget ${BUDGETS.largestArtAssetKb} KB`);
  }
  console.log(`Largest art: ${largest?.name} (${largest?.size} KB)`);
}

if (failures.length > 0) {
  console.error("\nBudget violations:");
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

console.log("\n✓ All budgets within thresholds");
```

В root `package.json`:
```json
"perf:budget": "node scripts/bundle-budget.mjs"
```

---

## Стъпка 9 — Load test setup (Colyseus)

### `scripts/loadtest.mjs`

```js
import { Client } from "@colyseus/loadtest";

const TARGET = process.env.LOAD_TARGET ?? "ws://localhost:2567";
const NUM_CLIENTS = Number(process.env.LOAD_CLIENTS ?? 50);
const ROOM_NAME = "game";

const clients = [];
const stats = {
  connected: 0,
  errors: 0,
  startTime: Date.now(),
};

for (let i = 0; i < NUM_CLIENTS; i++) {
  const client = new Client(TARGET);
  try {
    const room = await client.joinOrCreate(ROOM_NAME, {
      code: `LOAD${String(i).padStart(3, "0")}`,
      userId: `load-${i}`,
      displayName: `Тест ${i}`,
    });

    room.onMessage("*", () => {});
    room.onLeave(() => stats.connected--);

    clients.push({ client, room });
    stats.connected++;
  } catch (error) {
    stats.errors++;
    console.error(`Client ${i} failed:`, error.message);
  }
}

console.log(`Connected: ${stats.connected}/${NUM_CLIENTS}, errors: ${stats.errors}`);
console.log(`Setup time: ${Date.now() - stats.startTime}ms`);

// Хвани latency measurements за 30 секунди
setTimeout(async () => {
  console.log("Shutting down load test...");
  await Promise.all(clients.map(({ room }) => room.leave()));
  process.exit(stats.errors > NUM_CLIENTS * 0.1 ? 1 : 0);
}, 30_000);
```

В root `package.json`:
```json
"loadtest": "node scripts/loadtest.mjs",
"loadtest:heavy": "LOAD_CLIENTS=500 node scripts/loadtest.mjs"
```

**Не включвай** load tests в `pnpm verify` — те са bursty + slow + изискват real game-server. Стартирай ги ръчно преди major release.

---

## Стъпка 10 — Migration tests

### `scripts/test-migrations.mjs`

```js
import { spawnSync } from "node:child_process";
import { Client } from "pg";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/werewolf_test";

async function recreateTestDb() {
  const adminUrl = TEST_DB_URL.replace(/\/werewolf_test$/, "/postgres");
  const client = new Client(adminUrl);
  await client.connect();
  await client.query("DROP DATABASE IF EXISTS werewolf_test");
  await client.query("CREATE DATABASE werewolf_test");
  await client.end();
}

async function runMigrations() {
  const result = spawnSync("pnpm", ["--filter", "@werewolf/database", "db:migrate"], {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
  return result.status === 0;
}

async function verifySchema() {
  const client = new Client(TEST_DB_URL);
  await client.connect();
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  `);
  const tables = result.rows.map((r) => r.table_name);
  await client.end();

  const expected = ["user", "session", "account", "verification", "games", "game_events", "game_players", "user_achievements"];
  const missing = expected.filter((t) => !tables.includes(t));
  if (missing.length > 0) {
    console.error("Missing tables:", missing);
    return false;
  }
  return true;
}

(async () => {
  console.log("▶ Recreating test database...");
  await recreateTestDb();

  console.log("▶ Running migrations...");
  if (!(await runMigrations())) {
    console.error("✗ Migrations failed");
    process.exit(1);
  }

  console.log("▶ Verifying schema...");
  if (!(await verifySchema())) {
    console.error("✗ Schema verification failed");
    process.exit(1);
  }

  console.log("✓ Migration tests passed");
})();
```

В root `package.json`:
```json
"test:migrations": "node scripts/test-migrations.mjs"
```

**Изисква**: локален PG instance. В CI — services PG в GitHub Actions.

---

## CI integration — extend pnpm verify

Обнови root `package.json`:

```json
{
  "scripts": {
    "verify": "pnpm optimize:assets && pnpm regression && pnpm typecheck && pnpm build && pnpm smoke && pnpm frontend:e2e && pnpm e2e:auth && pnpm playtest && pnpm test && pnpm visual && pnpm perf:budget",
    "verify:heavy": "pnpm verify && pnpm test:migrations && pnpm loadtest"
  }
}
```

`verify:heavy` за preflight преди major release. `verify` стандартен за CI on push.

### `.github/workflows/ci.yml` (ако има GitHub Actions)

Ако проектът има CI workflow, добави:
- Service: postgres:17 за `test:migrations`
- Cache: pnpm store + playwright browsers
- Artifacts: visual regression diff на failure (за PR review)

(Codex: ако `.github/workflows/` не съществува, пропусни и заведи това като follow-up task.)

---

## Регресионни contract проверки (extend regression.mjs)

Добави нови контракти в `scripts/regression.mjs`:

1. **OAuth mock guard** — assert-ва, че `OAUTH_MOCK` flag е disabled в production build (по модел на ALLOW_DEV_AUTH check).
2. **Anonymous flow gone** — grep-ва `apps/web/{app,components}` за останали "без акаунт"/"без регистрация"/"anonymous" copy; fail-ва ако намери.
3. **Visual baseline exists** — assert-ва, че `apps/web/__visual__/__baseline__/` съществува и има >= 30 PNG-та (15 routes × 2 viewports).
4. **Bundle budget script wired** — assert-ва, че `perf:budget` script е в `package.json`.

---

## Acceptance criteria

1. **Dependencies** добавени само в dev: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@colyseus/loadtest`.
2. **Vitest config** за `apps/web` с jsdom environment + setup file.
3. **Unit tests** добавени: role-assignment, phase-vocabulary, expanded game-token security.
4. **Integration tests** добавени: GameRoom.reconnect, GameRoom.full-night, GameRoom.mayor-succession, GameRoom.race-conditions.
5. **Component tests** добавени за: LobbyWizard, OAuthButton, AuthChip, DayClueChips, MainHeadline.
6. **API contract tests** добавени за: /api/game-token, /api/achievements, /api/account/delete.
7. **E2E auth flows** в `scripts/e2e-auth.mjs` (5 сценарија) + OAuth mock middleware.
8. **Visual regression baseline** създаден: 30+ screenshots в `apps/web/__visual__/__baseline__/`.
9. **Bundle budget script** `scripts/bundle-budget.mjs` + `perf:budget` npm script.
10. **Load test script** `scripts/loadtest.mjs` + `loadtest` + `loadtest:heavy` npm scripts.
11. **Migration test script** `scripts/test-migrations.mjs` + `test:migrations` npm script.
12. **Verify chain** обновен с `visual` + `perf:budget`. `verify:heavy` добавен за тежки suites.
13. **Regression contracts** разширени с 4 нови проверки.
14. **БГ-only copy** в test descriptions / error messages (където са user-facing).
15. **Никакви a11y тестове** или dependencies (axe-playwright, etc.) — изрично изключени.

---

## Verification

1. `pnpm install` — резолва новите dev deps.
2. `pnpm --filter web test` — vitest пуска новите component + contract тестове.
3. `pnpm --filter @werewolf/shared test` — нови unit тестове passing.
4. `pnpm --filter @werewolf/game-server test` — нови integration тестове passing.
5. `pnpm visual:update` веднъж за initial baseline → commit screenshots.
6. `pnpm visual` повторно → minimal diff, всичко минава.
7. `pnpm perf:budget` (след `pnpm build`) — budgets passed.
8. `pnpm test:migrations` (с local PG) — schema verified.
9. `pnpm loadtest` (с running game-server) — 50 виртуални играчи свързват < 5s, error rate < 10%.
10. `pnpm verify` от край до край — преминава.

---

## Не пипай

- Core game-server logic (`apps/game-server/src/game-logic`, `apps/game-server/src/rooms/GameRoom.ts`) — само пиши тестове против тях.
- `packages/shared/src/{role-assignment,win-conditions,protocol}.ts` — само тестове.
- Production code paths които не са свързани с тестване.
- Без a11y инструменти (axe-playwright, axe-core, eslint-plugin-jsx-a11y) — user-ът изрично забрани.

---

## Commit strategy

Recommended commits on a new branch `feat/test-coverage-launch`. **All commit messages must be in English** (this is a project convention going forward).

1. `chore(test): add @testing-library + jsdom + colyseus loadtest deps`
2. `chore(test): vitest config with jsdom for apps/web components`
3. `test(shared): unit tests for role-assignment + phase-vocabulary`
4. `test(shared): expand security tests for game-token`
5. `test(game-server): integration tests for reconnect, full-night, mayor-succession, race-conditions`
6. `test(web): component tests for LobbyWizard, OAuthButton, AuthChip`
7. `test(web): component tests for DayClueChips, MainHeadline`
8. `test(web): API contract tests for game-token, achievements, account/delete`
9. `test(e2e): auth flow scenarios in scripts/e2e-auth.mjs + OAuth mock middleware`
10. `test(visual): regression baseline for 30+ pages (15 routes × 2 viewports)`
11. `test(perf): bundle budget script`
12. `test(loadtest): Colyseus 50-player load script`
13. `test(migrations): schema verification script`
14. `chore(ci): extend pnpm verify chain + regression contracts`
15. `docs(test): testing strategy document at docs/testing.md`

PR title: `feat: pre-launch test coverage — unit, integration, component, contract, E2E, visual, perf, load, migrations`.

---

(End of prompt)

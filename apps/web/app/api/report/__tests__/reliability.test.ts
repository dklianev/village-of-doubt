import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { reportAttempt, sendReportEmail } from "../delivery";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn(async () => null as unknown) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/runtime-rate-limit", async () => {
  const { createMemoryRateLimitBackend } = await import("@/lib/rate-limit");
  return { getRuntimeRateLimitBackend: () => createMemoryRateLimitBackend() };
});

const body = { type: "bug", body: "Synthetic report with enough detail.", email: null, evidence: null };
const email = { to: "operator@example.com", subject: "Synthetic report", html: "<p>Test</p>", text: "Test" };
let ip = 0;
const key = (at = Date.now()) => `${at}.${randomBytes(32).toString("hex")}`;
function request(payload: unknown = body, attempt = key(), address = `198.51.100.${++ip}`) {
  return new Request("http://localhost/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": attempt, "x-forwarded-for": address },
    body: JSON.stringify(payload),
  });
}

// Simulate the provider contract, not process-local application deduplication.
const accepted = new Map<string, { payload: string; id: string; pending: boolean }>();
let gate: Promise<void> | undefined;
let loseConfirmation = false;
async function provider(_input: unknown, init?: RequestInit) {
  const idempotencyKey = new Headers(init!.headers).get("Idempotency-Key")!;
  const payload = init!.body as string;
  const prior = accepted.get(idempotencyKey);
  if (prior) {
    if (prior.payload !== payload) return Response.json({ name: "invalid_idempotent_request" }, { status: 409 });
    if (prior.pending) return Response.json({ name: "concurrent_idempotent_requests" }, { status: 409 });
    return Response.json({ id: prior.id });
  }
  const entry = { payload, id: `synthetic-${accepted.size + 1}`, pending: true };
  accepted.set(idempotencyKey, entry);
  await gate;
  entry.pending = false;
  if (loseConfirmation) {
    loseConfirmation = false;
    throw new Error("Lost response after acceptance, synthetic-secret@example.com");
  }
  return Response.json({ id: entry.id });
}

beforeEach(() => {
  accepted.clear();
  gate = undefined;
  loseConfirmation = false;
  getSession.mockReset().mockResolvedValue(null);
  vi.stubEnv("RESEND_API_KEY", "synthetic-provider-key");
  vi.stubEnv("REPORTS_NOTIFY_EMAIL", "operator@example.com");
  vi.stubEnv("RESEND_FROM", "reports@example.com");
  vi.spyOn(globalThis, "fetch").mockImplementation(provider);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("report delivery idempotency", () => {
  it("returns the same reference and sends once after acceptance without confirmation, even after a module reload", async () => {
    const attempt = key();
    loseConfirmation = true;
    const first = await POST(request(body, attempt));
    expect(first.status).toBe(503);
    expect(first.headers.get("retry-after")).toBe("5");
    expect(await first.json()).not.toHaveProperty("referenceId");
    expect(accepted.size).toBe(1);

    vi.resetModules();
    const { POST: anotherProcess } = await import("../route");
    const retry = await anotherProcess(request(body, attempt));
    const confirmation = await retry.json();
    expect(retry.status).toBe(200);
    expect(confirmation).toEqual({ ok: true, referenceId: reportAttempt(attempt).referenceId });
    expect(await (await POST(request(body, attempt))).json()).toEqual(confirmation);
    expect(accepted.size).toBe(1);
    expect([...accepted.values()][0]!.payload).toContain(confirmation.referenceId);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("synthetic-secret");
  });

  it("handles concurrent requests without minting a new reference or sending twice", async () => {
    let finish!: () => void;
    gate = new Promise<void>((resolve) => { finish = resolve; });
    const attempt = key();
    const first = POST(request(body, attempt));
    await vi.waitFor(() => expect(accepted.size).toBe(1));
    const concurrent = await POST(request(body, attempt));
    expect(concurrent.status).toBe(409);
    expect(concurrent.headers.get("retry-after")).toBe("5");
    expect(await concurrent.json()).not.toHaveProperty("referenceId");
    finish();
    const delivered = await (await first).json();
    expect(await (await POST(request(body, attempt))).json()).toEqual(delivered);
    expect(accepted.size).toBe(1);
  });

  it.each([
    { type: "other" }, { body: "Changed synthetic report with enough detail." },
    { email: "reporter@example.com" }, { evidence: "Synthetic room ABC123" },
  ])("rejects changed payload under the same key: %j", async (change) => {
    const attempt = key();
    const first = await (await POST(request(body, attempt))).json();
    const conflict = await POST(request({ ...body, ...change }, attempt));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).not.toHaveProperty("referenceId");
    expect(accepted.size).toBe(1);
    expect(await (await POST(request(body, attempt))).json()).toEqual(first);
    expect((await POST(request({ ...body, ...change }, key()))).status).toBe(200);
    expect(accepted.size).toBe(2);
  });

  it("normalizes whitespace and optional fields before provider payload comparison", async () => {
    const attempt = key();
    const first = await (await POST(request(body, attempt))).json();
    const equivalent = { ...body, body: `  ${body.body}  `, evidence: "  ", email: "  " };
    expect(await (await POST(request(equivalent, attempt))).json()).toEqual(first);
    expect(accepted.size).toBe(1);
  });

  it("never resolves session identity for anonymous reports, even on retry with auth cookies", async () => {
    getSession.mockResolvedValue({ user: { name: "Synthetic account", email: "account@example.com" } });
    const attempt = key();
    for (const cookie of ["session=synthetic-a", "session=synthetic-b"]) {
      const req = request(body, attempt);
      req.headers.set("cookie", cookie);
      expect((await POST(req)).status).toBe(200);
    }
    expect(getSession).not.toHaveBeenCalled();
    expect(accepted.size).toBe(1);
    expect([...accepted.values()][0]!.payload).not.toMatch(/Synthetic account|account@example|session=/);
    expect([...accepted.keys()][0]).toMatch(/^report\/[a-f0-9]{64}$/);
  });

  it("rechecks identified auth on every retry and fails closed on changed session attribution", async () => {
    const payload = { ...body, email: "reporter@example.com" };
    const attempt = key();
    const session = { user: { name: "Synthetic reporter", email: "reporter@example.com" } };
    getSession.mockResolvedValue(session);
    const original = await (await POST(request(payload, attempt))).json();
    expect([...accepted.values()][0]!.payload).toContain("Synthetic reporter");
    getSession.mockResolvedValue({ user: { name: "Unrelated account", email: "other@example.com" } });
    expect((await POST(request(payload, attempt))).status).toBe(409);
    getSession.mockRejectedValueOnce(new Error("synthetic auth outage"));
    expect((await POST(request(payload, attempt))).status).toBe(409);
    getSession.mockResolvedValue(session);
    expect(await (await POST(request(payload, attempt))).json()).toEqual(original);
    expect(getSession).toHaveBeenCalledTimes(4);
    expect(accepted.size).toBe(1);
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toContain("Unrelated account");
  });

  it("applies rate limiting to duplicates, without letting fresh keys bypass the limit", async () => {
    const address = "203.0.113.237";
    const attempt = key();
    for (let count = 0; count < 5; count++) expect((await POST(request(body, attempt, address))).status).toBe(200);
    expect(accepted.size).toBe(1);
    for (const nextKey of [attempt, key()]) {
      const limited = await POST(request(body, nextKey, address));
      expect(limited.status).toBe(429);
      expect(limited.headers.get("retry-after")).toBeTruthy();
    }
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it("allows the same attempt after a failure before provider acceptance", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("synthetic connection failure"));
    const attempt = key();
    expect((await POST(request(body, attempt))).status).toBe(503);
    expect(accepted.size).toBe(0);
    expect((await POST(request(body, attempt))).status).toBe(200);
    expect(accepted.size).toBe(1);
    expect(new Headers(vi.mocked(fetch).mock.calls[0]![1]!.headers).get("Idempotency-Key"))
      .toBe(new Headers(vi.mocked(fetch).mock.calls[1]![1]!.headers).get("Idempotency-Key"));
  });

  it("requires a bounded opaque key and validates payload before any provider request", async () => {
    for (const invalid of ["", "reporter@example.com", "x".repeat(300), key(Date.now() + 61_000)]) {
      const req = request(body, invalid);
      if (!invalid) req.headers.delete("Idempotency-Key");
      expect((await POST(req)).status).toBe(400);
    }
    expect((await POST(request({ ...body, body: "short" }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("rejects expired attempts rather than resending beyond the provider retention period", async () => {
    vi.useFakeTimers();
    const attempt = key();
    expect((await POST(request(body, attempt))).status).toBe(200);
    const start = Date.now();
    vi.setSystemTime(start + 23 * 60 * 60 * 1000 - 1);
    expect((await POST(request(body, attempt))).status).toBe(200);
    vi.setSystemTime(start + 23 * 60 * 60 * 1000);
    expect((await POST(request(body, attempt))).status).toBe(409);
    vi.setSystemTime(start + 25 * 60 * 60 * 1000);
    expect((await POST(request(body, attempt))).status).toBe(409);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(accepted.size).toBe(1);
  });

  it("revalidates the time window after delayed auth, before sending", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    getSession.mockImplementationOnce(async () => {
      vi.setSystemTime(start + 23 * 60 * 60 * 1000);
      return null;
    });
    expect((await POST(request({ ...body, email: "reporter@example.com" }, key(start)))).status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed without a provider instead of logging PII to the development email sink", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log");
    expect((await POST(request({ ...body, email: "reporter@example.com" }))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("reporter@example.com");
  });
});

describe("report provider transport", () => {
  it.each(["request", "body"])("bounds a hung provider %s, aborts and safely retries the same key", async (phase) => {
    vi.useFakeTimers();
    const never = new Promise<Response>(() => {});
    if (phase === "request") vi.mocked(fetch).mockReturnValueOnce(never);
    else vi.mocked(fetch).mockResolvedValueOnce({ json: () => never } as unknown as Response);
    const attempt = key();
    const result = expect(sendReportEmail(email, attempt)).rejects.toMatchObject({ kind: "uncertain" });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(vi.mocked(fetch).mock.calls[0]![1]!.signal!.aborted).toBe(true);
    await sendReportEmail(email, attempt);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[1]![1]!.headers).toEqual(calls[0]![1]!.headers);
    expect(calls[1]![1]!.body).toBe(calls[0]![1]!.body);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    [200, "not-json"], [200, "null"], [200, "{}"], [200, '{"id":""}'],
    [429, '{"name":"rate_limit_exceeded"}'], [500, '{"message":"synthetic-private@example.com"}'],
  ])("does not confirm malformed or failed provider response %s %s", async (status, payload) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(payload, { status }));
    await expect(sendReportEmail(email, key())).rejects.toMatchObject({ kind: "uncertain" });
    expect(console.error).not.toHaveBeenCalled();
  });
});

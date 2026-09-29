import { describe, expect, it } from "vitest";
import { computeOverallStatus, parseStatusSnapshot } from "../status-health-shared";
import { statusSnapshot } from "../../components/status/__tests__/status-fixtures";

describe("parseStatusSnapshot", () => {
  it("accepts complete public snapshots and strips unrecognized fields", () => {
    const snapshot = statusSnapshot();
    const result = parseStatusSnapshot({
      ...snapshot, internal: "private-probe",
      services: snapshot.services.map((service) => ({ ...service, endpoint: "private-probe" })),
    });
    expect(result).toEqual(snapshot);
    expect(JSON.stringify(result)).not.toContain("private-probe");
  });

  it.each([null, [], {}, "invalid", { ...statusSnapshot(), services: [] },
    { ...statusSnapshot(), lastCheckedAt: "invalid" },
    { ...statusSnapshot(), lastCheckedAt: "2026-02-30T00:00:00.000Z" },
    { ...statusSnapshot(), lastCheckedAt: "10:00" },
    { ...statusSnapshot(), services: statusSnapshot().services.slice(0, 4) },
  ])("rejects missing or malformed snapshots: %j", (value) => {
    expect(parseStatusSnapshot(value)).toBeNull();
  });

  it.each([
    { id: "unrecognized" }, { id: "__proto__" }, { id: "database" },
    { name: null }, { name: " " }, { name: "a".repeat(121) },
    { description: {} }, { description: "a".repeat(501) },
    { status: "healthy" }, { icon: "missing" }, { icon: "database" },
    { detail: {} }, { detail: "a".repeat(501) },
  ])("rejects malformed or duplicate services: %j", (fields) => {
    const snapshot = statusSnapshot();
    expect(parseStatusSnapshot({ ...snapshot, services: [{ ...snapshot.services[0], ...fields }, ...snapshot.services.slice(1)] })).toBeNull();
  });
});

describe("computeOverallStatus", () => {
  it("describes only verified critical services as operational", () => {
    expect(computeOverallStatus(statusSnapshot().services)).toBe("ok");
  });

  it("does not mistake empty, incomplete, or unknown critical service lists for healthy or degraded", () => {
    expect(computeOverallStatus([])).toBe("unknown");
    expect(computeOverallStatus(statusSnapshot().services.slice(0, 1))).toBe("unknown");
    const { services } = statusSnapshot();
    services[1]!.status = "unknown";
    expect(computeOverallStatus(services)).toBe("unknown");
  });

  it("does not hide a known degraded external service behind successful critical probes", () => {
    const { services } = statusSnapshot();
    services[4]!.status = "degraded";
    expect(computeOverallStatus(services)).toBe("degraded");
    services[1]!.status = "down";
    expect(computeOverallStatus(services)).toBe("down");
  });
});

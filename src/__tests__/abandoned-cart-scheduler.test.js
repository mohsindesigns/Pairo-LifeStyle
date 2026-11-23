import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The scheduler only decides WHEN to scan, so the scan itself is replaced and no database is needed.
describe("abandoned-cart scheduler", () => {
  let scan;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    delete globalThis.__pairoAbandonedCartScheduler;
    scan = vi.fn(async () => ({ scanned: 0, sent: 0, failed: 0 }));
    vi.doMock("@/lib/abandonedCartService", () => ({ sendAbandonedCartRecoveryEmails: scan }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/abandonedCartService");
    delete globalThis.__pairoAbandonedCartScheduler;
  });

  const load = async () => (await import("@/lib/abandonedCartScheduler")).startAbandonedCartScheduler;

  it("first scans after a minute, then every five minutes, as the automatic scheduler", async () => {
    const start = await load();
    expect(start()).toBe(true);
    expect(scan).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(59_000);
    expect(scan).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenLastCalledWith({ trigger: "scheduler" });

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(scan).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(scan).toHaveBeenCalledTimes(3);
  });

  it("starts only once per process", async () => {
    const start = await load();
    expect(start()).toBe(true);
    expect(start()).toBe(false);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(scan).toHaveBeenCalledTimes(3); // the 1, 5 and 10 minute marks; a second start would have doubled it
  });

  it("never lets two scans overlap, and keeps going after a scan fails", async () => {
    let release;
    scan.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ scanned: 0, sent: 0, failed: 0 }); }));
    const start = await load();
    start();

    await vi.advanceTimersByTimeAsync(60_000); // scan 1 starts and stays busy
    await vi.advanceTimersByTimeAsync(5 * 60_000); // the 5-minute tick finds it still running and skips
    expect(scan).toHaveBeenCalledTimes(1);

    release();
    scan.mockImplementationOnce(async () => { throw new Error("db down"); });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(scan).toHaveBeenCalledTimes(2); // runs again, and the thrown error is swallowed
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(scan).toHaveBeenCalledTimes(3);
  });

  it("can be switched off with DISABLE_INTERNAL_SCHEDULER", async () => {
    for (const value of ["1", "true", "TRUE"]) {
      delete globalThis.__pairoAbandonedCartScheduler;
      vi.stubEnv("DISABLE_INTERNAL_SCHEDULER", value);
      const start = await load();
      expect(start()).toBe(false);
    }
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(scan).not.toHaveBeenCalled();
  });
});

describe("instrumentation: when the server starts the scheduler", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    delete globalThis.__pairoAbandonedCartScheduler;
    vi.doMock("@/lib/abandonedCartService", () => ({ sendAbandonedCartRecoveryEmails: vi.fn(async () => ({ scanned: 0, sent: 0, failed: 0 })) }));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/abandonedCartService");
    delete globalThis.__pairoAbandonedCartScheduler;
  });

  const register = async () => (await import("@/instrumentation")).register();

  it("starts it on a production Node server", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "");
    await register();
    expect(globalThis.__pairoAbandonedCartScheduler).toBe(true);
  });

  it("does not start while developing, on the edge runtime, or while building", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "development");
    await register();
    expect(globalThis.__pairoAbandonedCartScheduler).toBeUndefined();

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    expect(globalThis.__pairoAbandonedCartScheduler).toBeUndefined();

    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    await register();
    expect(globalThis.__pairoAbandonedCartScheduler).toBeUndefined();
  });
});

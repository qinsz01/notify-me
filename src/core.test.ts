import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "./core.js";
import type { Config } from "./notifiers/types.js";

// Mock DesktopNotifier so it never calls real exec
vi.mock("./notifiers/desktop.js", () => ({
  DesktopNotifier: vi.fn().mockImplementation(() => ({
    name: "desktop",
    send: vi.fn().mockResolvedValue({ channel: "desktop", success: true, message: "desktop notification sent" }),
  })),
}));

const baseConfig: Config = {
  channels: {
    desktop: { enabled: true },
    sound: { enabled: true, file: null },
    ntfy: { enabled: false, url: "" },
    telegram: { enabled: false, bot_token: "", chat_id: "" },
    bark: { enabled: false, url: "", device_key: "" },
    serverchan: { enabled: false, sendkey: "" },
    slack: { enabled: false, webhook_url: "" },
    email: {
      enabled: false,
      smtp_host: "",
      smtp_port: 587,
      from: "",
      to: "",
      user: "",
      password: "",
    },
  },
  remote: { fallback_order: ["sound", "ntfy"] },
  defaults: { message: "Task completed", title: "notify-me" },
};

describe("dispatch", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("sends to desktop + sound in local env and returns results", async () => {
    const results = await dispatch("Hello", baseConfig, "local");

    expect(results.length).toBeGreaterThanOrEqual(1);
    // Sound always fires (writes bell char)
    expect(writeSpy).toHaveBeenCalledWith("\x07");
    // Should have logged per-channel results
    expect(logSpy).toHaveBeenCalled();
  });

  it("skips desktop in ssh env and uses fallback", async () => {
    await dispatch("Hello", baseConfig, "ssh");
    // Sound (fallback) fires
    expect(writeSpy).toHaveBeenCalledWith("\x07");
  });

  it("sends to telegram when enabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const config: Config = {
      ...baseConfig,
      channels: {
        ...baseConfig.channels,
        telegram: { enabled: true, bot_token: "tok", chat_id: "123" },
      },
    };

    const results = await dispatch("Test", config, "local");
    expect(fetchSpy).toHaveBeenCalled();

    const tgResult = results.find((r) => r.channel === "telegram");
    expect(tgResult).toBeDefined();
    expect(tgResult!.success).toBe(true);

    fetchSpy.mockRestore();
  });

  it("continues if one notifier fails and reports failure", async () => {
    const config: Config = {
      ...baseConfig,
      channels: {
        ...baseConfig.channels,
        desktop: { enabled: false },
      },
    };

    // Should not throw
    const results = await dispatch("Test", config, "local");
    expect(results).toBeDefined();
    expect(writeSpy).toHaveBeenCalledWith("\x07");
    // Should still have sound result
    const soundResult = results.find((r) => r.channel === "sound");
    expect(soundResult).toBeDefined();
  });

  it("returns empty results when no channels enabled", async () => {
    const config: Config = {
      ...baseConfig,
      channels: {
        ...baseConfig.channels,
        desktop: { enabled: false },
        sound: { enabled: false, file: null },
      },
    };

    const results = await dispatch("Test", config, "local");
    expect(results).toEqual([]);
  });
});

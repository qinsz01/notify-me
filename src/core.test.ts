import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "./core.js";
import type { Config } from "./notifiers/types.js";

// Mock DesktopNotifier so it never calls real exec
vi.mock("./notifiers/desktop.js", () => ({
  DesktopNotifier: vi.fn().mockImplementation(() => ({
    name: "desktop",
    send: vi.fn().mockResolvedValue(undefined),
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

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  it("sends to desktop + sound in local env", async () => {
    await dispatch("Hello", baseConfig, "local");
    // Sound always fires (writes bell char)
    expect(writeSpy).toHaveBeenCalledWith("\x07");
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

    await dispatch("Test", config, "local");
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("continues if one notifier fails", async () => {
    const config: Config = {
      ...baseConfig,
      channels: {
        ...baseConfig.channels,
        desktop: { enabled: false },
      },
    };

    // Should not throw
    await expect(dispatch("Test", config, "local")).resolves.toBeUndefined();
    expect(writeSpy).toHaveBeenCalledWith("\x07");
  });
});

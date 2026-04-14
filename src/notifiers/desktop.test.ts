import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DesktopNotifier } from "./desktop.js";

describe("DesktopNotifier", () => {
  let notifier: DesktopNotifier;
  let execMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    execMock = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    notifier = new DesktopNotifier(execMock);
  });

  afterEach(() => {
    execMock.mockRestore();
  });

  it("has name 'desktop'", () => {
    expect(notifier.name).toBe("desktop");
  });

  it("calls notify-send on Linux and returns success", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });

    const result = await notifier.send("Hello", { title: "Test" });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("desktop");

    expect(execMock).toHaveBeenCalled();
    const cmd = execMock.mock.calls[0][0];
    expect(cmd).toContain("notify-send");
    expect(cmd).toContain("Test");
    expect(cmd).toContain("Hello");

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("returns failure on exec error", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });

    execMock.mockRejectedValue(new Error("notify-send not found"));

    const result = await notifier.send("Hello");
    expect(result.success).toBe(false);
    expect(result.message).toContain("notify-send not found");

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});

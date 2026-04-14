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

  it("calls notify-send with args array on Linux", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });

    const result = await notifier.send("Hello World", { title: "Test" });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("desktop");

    expect(execMock).toHaveBeenCalledWith("notify-send", ["-u", "normal", "Test", "Hello World"]);

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("calls osascript on macOS", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });

    const result = await notifier.send("Hello", { title: "Test" });

    expect(result.success).toBe(true);
    expect(execMock).toHaveBeenCalledWith("osascript", [
      "-e",
      'display notification "Hello" with title "Test"',
    ]);

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

  it("safely handles shell metacharacters in message", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux" });

    await notifier.send('test; rm -rf / && echo "pwned"', { title: "Alert" });

    // execFile passes args as array, no shell interpretation
    const args = execMock.mock.calls[0][1];
    expect(args[3]).toBe('test; rm -rf / && echo "pwned"');

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SoundNotifier } from "./sound.js";

const mockExec = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

describe("SoundNotifier", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    mockExec.mockClear();
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("has name 'sound'", () => {
    const notifier = new SoundNotifier(null, mockExec);
    expect(notifier.name).toBe("sound");
  });

  it("writes bell character to stdout and returns success", async () => {
    const notifier = new SoundNotifier(null, mockExec);
    const result = await notifier.send("test message");

    expect(result.channel).toBe("sound");
    expect(result.success).toBe(true);
    expect(result.message).toContain("terminal bell");
    expect(writeSpy).toHaveBeenCalledWith("\x07");
  });

  it("writes bell character regardless of message content", async () => {
    const notifier = new SoundNotifier(null, mockExec);
    const result = await notifier.send("any message at all");
    expect(result.success).toBe(true);
    expect(writeSpy).toHaveBeenCalledWith("\x07");
  });

  it("attempts to play audio file and includes it in result", async () => {
    const notifier = new SoundNotifier(null, mockExec);
    const result = await notifier.send("test");

    expect(result.success).toBe(true);
    expect(result.channel).toBe("sound");
    expect(mockExec).toHaveBeenCalled();
    const [cmd, args] = mockExec.mock.calls[0];
    expect(cmd).toBe("paplay");
    expect(args[0]).toContain(".oga");
  });
});

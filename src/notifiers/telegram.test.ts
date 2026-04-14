import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TelegramNotifier } from "./telegram.js";

describe("TelegramNotifier", () => {
  let notifier: TelegramNotifier;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    notifier = new TelegramNotifier("123:ABC", "456");
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has name 'telegram'", () => {
    expect(notifier.name).toBe("telegram");
  });

  it("sends message via Telegram Bot API and returns success result", async () => {
    const result = await notifier.send("Build failed", { title: "Alert" });

    expect(result.channel).toBe("telegram");
    expect(result.success).toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.chat_id).toBe("456");
    expect(body.text).toContain("Alert");
    expect(body.text).toContain("Build failed");
  });

  it("returns failure on HTTP error", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "Bad Request" }), { status: 400 })
    );

    const result = await notifier.send("test");
    expect(result.success).toBe(false);
    expect(result.message).toContain("HTTP 400");
  });

  it("returns failure on network error", async () => {
    fetchSpy.mockRejectedValue(new Error("Network timeout"));

    const result = await notifier.send("test");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Network timeout");
  });
});

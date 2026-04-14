import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BarkNotifier } from "./bark.js";

describe("BarkNotifier", () => {
  let notifier: BarkNotifier;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    notifier = new BarkNotifier("https://api.day.app", "my-key-12345678");
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 200 }), { status: 200 })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has name 'bark'", () => {
    expect(notifier.name).toBe("bark");
  });

  it("POSTs to Bark API and returns success result", async () => {
    const result = await notifier.send("Deploy done", { title: "MyApp" });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("bark");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.day.app/my-key-12345678");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.title).toBe("MyApp");
    expect(body.body).toBe("Deploy done");
  });

  it("returns failure on HTTP error", async () => {
    fetchSpy.mockResolvedValue(new Response("forbidden", { status: 403 }));

    const result = await notifier.send("test");
    expect(result.success).toBe(false);
    expect(result.message).toContain("HTTP 403");
  });

  it("returns failure on network error", async () => {
    fetchSpy.mockRejectedValue(new Error("connection refused"));

    const result = await notifier.send("test");
    expect(result.success).toBe(false);
    expect(result.message).toContain("connection refused");
  });
});

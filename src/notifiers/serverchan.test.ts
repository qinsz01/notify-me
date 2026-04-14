import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServerChanNotifier } from "./serverchan.js";

describe("ServerChanNotifier", () => {
  let notifier: ServerChanNotifier;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    notifier = new ServerChanNotifier("SCT123-testkey");
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: 0 }), { status: 200 })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has name 'serverchan'", () => {
    expect(notifier.name).toBe("serverchan");
  });

  it("POSTs to Server酱 API and returns success", async () => {
    const result = await notifier.send("Build OK", { title: "Project" });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("serverchan");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://sctapi.ftqq.com/SCT123-testkey.send");
    expect(init?.method).toBe("POST");
    const body = new URLSearchParams(init?.body as string);
    expect(body.get("title")).toBe("Project");
    expect(body.get("desp")).toBe("Build OK");
  });

  it("returns failure on HTTP error", async () => {
    fetchSpy.mockResolvedValue(new Response("error", { status: 500 }));

    const result = await notifier.send("test");
    expect(result.success).toBe(false);
    expect(result.message).toContain("HTTP 500");
  });
});

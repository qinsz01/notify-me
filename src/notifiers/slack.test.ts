import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SlackNotifier } from "./slack.js";

describe("SlackNotifier", () => {
  let notifier: SlackNotifier;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    notifier = new SlackNotifier("https://hooks.slack.com/services/T/B/x");
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("has name 'slack'", () => {
    expect(notifier.name).toBe("slack");
  });

  it("POSTs JSON payload to Slack webhook and returns success", async () => {
    const result = await notifier.send("Deploy complete", { title: "Alert" });

    expect(result.success).toBe(true);
    expect(result.channel).toBe("slack");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://hooks.slack.com/services/T/B/x");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body.text).toBe("*Alert*\nDeploy complete");
  });

  it("returns failure on HTTP error", async () => {
    fetchSpy.mockResolvedValue(new Response("invalid_payload", { status: 400 }));

    const result = await notifier.send("test");
    expect(result.success).toBe(false);
    expect(result.message).toContain("HTTP 400");
  });
});

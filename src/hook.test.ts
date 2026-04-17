import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { truncate, extractQuestions, handleHook } from "./hook.js";

const DEDUP_FILE = path.join(os.tmpdir(), "ai-ding-last-stop");

// Mock dispatch so we don't send real notifications
vi.mock("./core.js", () => ({
  dispatch: vi.fn().mockResolvedValue([]),
}));

vi.mock("./config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({
    channels: {
      desktop: { enabled: true },
      sound: { enabled: true, file: null },
      ntfy: { enabled: false, url: "" },
      telegram: { enabled: false, bot_token: "", chat_id: "" },
      bark: { enabled: false, url: "", device_key: "" },
      serverchan: { enabled: false, sendkey: "" },
      slack: { enabled: false, webhook_url: "" },
      email: { enabled: false, smtp_host: "", smtp_port: 587, from: "", to: "", user: "", password: "" },
    },
    remote: { fallback_order: ["sound", "ntfy"] },
    defaults: { message: "Task completed", title: "ai-ding" },
  }),
}));

vi.mock("./env.js", () => ({
  detectEnvironment: vi.fn().mockReturnValue("local"),
}));

import { dispatch } from "./core.js";

const mockDispatch = vi.mocked(dispatch);

describe("truncate", () => {
  it("returns string unchanged if within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and appends ellipsis", () => {
    expect(truncate("abcdefghij", 7)).toBe("abcd...");
  });

  it("handles exact length", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });
});

describe("extractQuestions", () => {
  it("returns default for null input", () => {
    expect(extractQuestions(null)).toBe("Claude has a question");
  });

  it("returns default for empty questions array", () => {
    expect(extractQuestions({ questions: [] })).toBe("Claude has a question");
  });

  it("extracts single question text", () => {
    expect(extractQuestions({ questions: [{ question: "Deploy now?" }] })).toBe("Deploy now?");
  });

  it("joins multiple questions with semicolon", () => {
    const result = extractQuestions({ questions: [{ question: "A?" }, { question: "B?" }] });
    expect(result).toBe("A?; B?");
  });
});

describe("handleHook", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    try { fs.unlinkSync(DEDUP_FILE); } catch { /* file may not exist */ }
  });

  it("does nothing on empty input", async () => {
    await handleHook("");
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("does nothing on invalid JSON", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handleHook("not json");
    expect(warnSpy).toHaveBeenCalledWith("[ai-ding] --hook: failed to parse stdin JSON");
    expect(mockDispatch).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("skips subagent events (agent_id present)", async () => {
    await handleHook(JSON.stringify({ agent_id: "sub-1", hook_event_name: "Stop" }));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("handles Stop event with last_assistant_message", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "Stop",
      last_assistant_message: "Fixed the auth bug",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("Fixed the auth bug", expect.anything(), expect.anything(), { title: "Claude Code" });
  });

  it("handles Stop event with no message (uses default)", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "Stop",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("Task completed", expect.anything(), expect.anything(), { title: "Claude Code" });
  });

  it("handles Codex Stop events when source is codex", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "Stop",
      session_id: "session-1",
      turn_id: "turn-1",
      last_assistant_message: "Need your approval to continue?",
    }), "codex");
    expect(mockDispatch).toHaveBeenCalledWith(
      "Need your approval to continue?",
      expect.anything(),
      expect.anything(),
      { title: "Codex", silent: true, hookSafe: true }
    );
  });

  it("handles Notification idle_prompt", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "Notification",
      notification_type: "idle_prompt",
      message: "",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("Claude is waiting for your input", expect.anything(), expect.anything(), { title: "Needs Attention" });
  });

  it("forwards non-idle/permission Notification (e.g. API errors)", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "Notification",
      notification_type: "other",
      message: "API Error: 400 Bad Request",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("API Error: 400 Bad Request", expect.anything(), expect.anything(), { title: "Claude Code" });
  });

  it("forwards Notification with empty message using notification_type as fallback", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "Notification",
      notification_type: "error",
      message: "",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("error", expect.anything(), expect.anything(), { title: "Claude Code" });
  });

  it("handles PreToolUse AskUserQuestion", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "AskUserQuestion",
      tool_input: { questions: [{ question: "Continue?" }] },
    }));
    expect(mockDispatch).toHaveBeenCalledWith("Continue?", expect.anything(), expect.anything(), { title: "Question" });
  });

  it("ignores PreToolUse for other tools", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: {},
    }));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("handles ExitPlanMode (plan approval)", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "ExitPlanMode",
      tool_input: {},
    }));
    expect(mockDispatch).toHaveBeenCalledWith("Plan ready for your approval", expect.anything(), expect.anything(), { title: "Plan Review" });
  });

  it("handles PermissionRequest event", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "PermissionRequest",
      tool_name: "Bash",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("Permission needed: Bash", expect.anything(), expect.anything(), { title: "Needs Attention" });
  });

  it("handles StopFailure (API error)", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "StopFailure",
      error: "rate_limit",
      error_details: "429 Too Many Requests",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("API Error: rate_limit: 429 Too Many Requests", expect.anything(), expect.anything(), { title: "Claude Code Error" });
  });

  it("handles StopFailure without details", async () => {
    await handleHook(JSON.stringify({
      hook_event_name: "StopFailure",
      error: "server_error",
    }));
    expect(mockDispatch).toHaveBeenCalledWith("API Error: server_error", expect.anything(), expect.anything(), { title: "Claude Code Error" });
  });
});

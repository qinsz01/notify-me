import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadConfig } from "./config.js";
import { detectEnvironment } from "./env.js";
import { dispatch } from "./core.js";

const DEDUP_FILE = path.join(os.tmpdir(), "ai-ding-last-stop");
const CODEX_DEDUP_DIR = path.join(os.tmpdir(), "ai-ding-codex-stop");
const DEDUP_WINDOW_MS = 5000;
type HookSource = "auto" | "claude" | "codex";

function markStop(): void {
  try { fs.writeFileSync(DEDUP_FILE, String(Date.now())); } catch { /* ignore */ }
}

function isRecentStop(): boolean {
  try {
    const ts = Number(fs.readFileSync(DEDUP_FILE, "utf8"));
    return Date.now() - ts < DEDUP_WINDOW_MS;
  } catch { return false; }
}

function buildCodexStopKey(data: Record<string, unknown>): string | null {
  const sessionId = typeof data.session_id === "string" ? data.session_id : "";
  const turnId = typeof data.turn_id === "string" ? data.turn_id : "";
  if (!sessionId || !turnId) return null;
  return `${sessionId}:${turnId}`;
}

function getCodexStopMarkerPath(key: string): string {
  const hash = createHash("sha1").update(key).digest("hex");
  return path.join(CODEX_DEDUP_DIR, hash);
}

function shouldSkipCodexStop(key: string): boolean {
  const markerPath = getCodexStopMarkerPath(key);

  try {
    const stats = fs.statSync(markerPath);
    if (Date.now() - stats.mtimeMs < DEDUP_WINDOW_MS) {
      return true;
    }
    fs.rmSync(markerPath, { force: true });
  } catch {
    // marker absent or unreadable; continue and attempt to claim this event
  }

  try {
    fs.mkdirSync(CODEX_DEDUP_DIR, { recursive: true });
    const fd = fs.openSync(markerPath, "wx");
    fs.closeSync(fd);
    return false;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EEXIST";
  }
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

export function extractQuestions(toolInput: unknown): string {
  if (!toolInput || typeof toolInput !== "object") return "Claude has a question";
  const input = toolInput as Record<string, unknown>;
  const questions = input.questions;
  if (!Array.isArray(questions) || questions.length === 0) return "Claude has a question";
  const texts = questions
    .map((q: Record<string, unknown>) => String(q.question ?? ""))
    .filter(Boolean);
  return texts.length > 0 ? truncate(texts.join("; "), 200) : "Claude has a question";
}

function inferHookSource(data: Record<string, unknown>): Exclude<HookSource, "auto"> {
  const event = data.hook_event_name as string | undefined;
  if (event === "Notification" || event === "StopFailure" || event === "PermissionRequest") {
    return "claude";
  }
  if (event === "SessionStart" || event === "PostToolUse" || event === "UserPromptSubmit") {
    return "codex";
  }
  if (event === "Stop") {
    if ("session_id" in data || "turn_id" in data || "stop_hook_active" in data) {
      return "codex";
    }
    return "claude";
  }
  return "claude";
}

export async function handleHook(input: string, source: HookSource = "auto"): Promise<void> {
  if (!input) return;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(input);
  } catch {
    console.warn("[ai-ding] --hook: failed to parse stdin JSON");
    return;
  }

  // Skip subagent events
  if (data.agent_id) return;

  const event = data.hook_event_name as string | undefined;
  const resolvedSource = source === "auto" ? inferHookSource(data) : source;
  const config = loadConfig();
  const env = detectEnvironment();

  if (resolvedSource === "codex") {
    if (event === "Stop") {
      const codexStopKey = buildCodexStopKey(data);
      if (codexStopKey && shouldSkipCodexStop(codexStopKey)) return;
      const raw = data.last_assistant_message;
      const lastMsg = truncate(typeof raw === "string" && raw ? raw : "Task completed", 200);
      await dispatch(lastMsg, config, env, { title: "Codex", silent: true, hookSafe: true });
    }
    return;
  }

  switch (event) {
    case "Stop": {
      markStop();
      const raw = data.last_assistant_message;
      const lastMsg = truncate(typeof raw === "string" && raw ? raw : "Task completed", 200);
      await dispatch(lastMsg, config, env, { title: "Claude Code" });
      break;
    }
    case "StopFailure": {
      const error = String(data.error ?? "unknown error");
      const details = data.error_details ? `: ${data.error_details}` : "";
      await dispatch(truncate(`API Error: ${error}${details}`, 200), config, env, { title: "Claude Code Error" });
      break;
    }
    case "Notification": {
      const msg = String(data.message ?? "");
      const notifType = String(data.notification_type ?? "");
      if (notifType === "idle_prompt") {
        // Skip if Stop just fired — that notification already covered it
        if (isRecentStop()) break;
        await dispatch("Claude is waiting for your input", config, env, { title: "Needs Attention" });
      } else if (notifType === "permission_prompt" ||
          msg.includes("idle") || msg.includes("permission")) {
        await dispatch("Claude is waiting for your input", config, env, { title: "Needs Attention" });
      } else {
        // Catch-all: forward any other notification (API errors, etc.)
        await dispatch(truncate(msg || notifType || "Unknown notification", 200), config, env, { title: "Claude Code" });
      }
      break;
    }
    case "PreToolUse": {
      const toolName = String(data.tool_name ?? "");
      if (toolName === "AskUserQuestion") {
        const questions = extractQuestions(data.tool_input);
        await dispatch(questions, config, env, { title: "Question" });
      } else if (toolName === "ExitPlanMode") {
        await dispatch("Plan ready for your approval", config, env, { title: "Plan Review" });
      }
      break;
    }
    case "PermissionRequest": {
      const toolName = String(data.tool_name ?? "");
      await dispatch(`Permission needed: ${toolName || "tool"}`, config, env, { title: "Needs Attention" });
      break;
    }
  }
}

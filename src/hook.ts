import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config.js";
import { detectEnvironment } from "./env.js";
import { dispatch } from "./core.js";

const DEDUP_FILE = path.join(os.tmpdir(), "ai-ding-last-stop");
const DEDUP_WINDOW_MS = 5000;

function markStop(): void {
  try { fs.writeFileSync(DEDUP_FILE, String(Date.now())); } catch { /* ignore */ }
}

function isRecentStop(): boolean {
  try {
    const ts = Number(fs.readFileSync(DEDUP_FILE, "utf8"));
    return Date.now() - ts < DEDUP_WINDOW_MS;
  } catch { return false; }
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

export async function handleHook(input: string): Promise<void> {
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
  const config = loadConfig();
  const env = detectEnvironment();

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

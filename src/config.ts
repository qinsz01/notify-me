import { readFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
import { resolve } from "node:path";
import type { Config } from "./notifiers/types.js";

const DEFAULT_CONFIG: Config = {
  channels: {
    desktop: { enabled: true },
    sound: { enabled: true, file: null },
    ntfy: { enabled: false, url: "" },
    telegram: { enabled: false, bot_token: "", chat_id: "" },
    bark: { enabled: false, url: "", device_key: "" },
    serverchan: { enabled: false, sendkey: "" },
    slack: { enabled: false, webhook_url: "" },
    email: {
      enabled: false,
      smtp_host: "",
      smtp_port: 587,
      from: "",
      to: "",
      user: "",
      password: "",
    },
  },
  remote: { fallback_order: ["sound", "ntfy"] },
  defaults: { message: "Task completed", title: "notify-me" },
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const ENV_VAR_MAP: Record<string, string> = {
  NOTIFY_ME_TELEGRAM_BOT_TOKEN: "channels.telegram.bot_token",
  NOTIFY_ME_TELEGRAM_CHAT_ID: "channels.telegram.chat_id",
  NOTIFY_ME_BARK_URL: "channels.bark.url",
  NOTIFY_ME_BARK_DEVICE_KEY: "channels.bark.device_key",
  NOTIFY_ME_SERVERCHAN_SENDKEY: "channels.serverchan.sendkey",
  NOTIFY_ME_SLACK_WEBHOOK_URL: "channels.slack.webhook_url",
  NOTIFY_ME_NTFY_URL: "channels.ntfy.url",
  NOTIFY_ME_EMAIL_SMTP_HOST: "channels.email.smtp_host",
  NOTIFY_ME_EMAIL_FROM: "channels.email.from",
  NOTIFY_ME_EMAIL_TO: "channels.email.to",
  NOTIFY_ME_EMAIL_USER: "channels.email.user",
  NOTIFY_ME_EMAIL_PASSWORD: "channels.email.password",
};

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

export function loadConfig(configPath?: string): Config {
  let merged: Record<string, unknown> = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  const paths = configPath
    ? [configPath]
    : [
        resolve(process.env.HOME || "~", ".notify-me.yaml"),
        resolve(".notify-me.yaml"),
      ];

  for (const p of paths) {
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf-8");
      const parsed = yaml.load(raw) as Record<string, unknown>;
      if (parsed) {
        merged = deepMerge(merged, parsed);
      }
      break;
    }
  }

  for (const [envVar, path] of Object.entries(ENV_VAR_MAP)) {
    const value = process.env[envVar];
    if (value) {
      setNestedValue(merged, path, value);
    }
  }

  return merged as unknown as Config;
}

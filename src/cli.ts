import { Command } from "commander";
import { resolve } from "node:path";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { loadConfig } from "./config.js";
import { detectEnvironment } from "./env.js";
import { dispatch } from "./core.js";
import { handleHook } from "./hook.js";
import { installCodex, uninstallCodex } from "./codex.js";

const program = new Command();

program
  .name("ai-ding")
  .description("Cross-platform notifications for AI coding assistants")
  .version("1.1.0")
  .argument("[message]", "notification message", "Task completed")
  .option("-t, --title <title>", "notification title")
  .option("-c, --channel <channel>", "send to specific channel only")
  .option("--no-desktop", "disable desktop notification")
  .option("--no-sound", "disable sound notification")
  .option("--init", "create default config file")
  .option("--test", "test all enabled notification channels")
  .option("--hook", "read hook event from stdin and send contextual notification")
  .option("--source <source>", "hook source for --hook")
  .option("--install-codex", "install ai-ding as a personal Codex plugin")
  .option("--uninstall-codex", "remove the personal Codex install created by ai-ding")
  .action(async (message: string, opts: Record<string, unknown>) => {
    if (opts.init) {
      initConfig();
      return;
    }

    if (opts.installCodex) {
      installCodex({
        homeDir: process.env.HOME || homedir(),
        packageRoot: resolve(import.meta.dirname ?? ".", ".."),
      });
      console.log("[ai-ding] Installed personal Codex plugin files.");
      console.log("[ai-ding] Updated ~/.agents/plugins/marketplace.json.");
      console.log("[ai-ding] Updated ~/.codex/hooks.json and enabled features.codex_hooks.");
      console.log("[ai-ding] Restart Codex to pick up the new plugin and hooks.");
      return;
    }

    if (opts.uninstallCodex) {
      uninstallCodex({
        homeDir: process.env.HOME || homedir(),
      });
      console.log("[ai-ding] Removed personal Codex plugin files, marketplace entry, and hook.");
      return;
    }

    if (opts.hook) {
      const input = await readStdin();
      const source = opts.source === "codex" || opts.source === "claude" ? opts.source : "auto";
      await handleHook(input, source);
      if (source === "codex") {
        process.stdout.write("{}\n");
      }
      return;
    }

    const config = loadConfig();

    // Apply CLI overrides
    if (opts.noDesktop) config.channels.desktop.enabled = false;
    if (opts.noSound) config.channels.sound.enabled = false;

    const title = typeof opts.title === "string" ? opts.title : undefined;
    const channel = typeof opts.channel === "string" ? opts.channel : undefined;

    if (opts.test) {
      console.log("[ai-ding] Testing all enabled channels...");
      const env = detectEnvironment();
      await dispatch(`Test notification from ai-ding (${env})`, config, env, { title, channel });
      return;
    }

    const env = detectEnvironment();
    await dispatch(message, config, env, { title, channel });
  });

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    let settled = false;
    process.stdin.setEncoding("utf-8");
    const timer = setTimeout(() => {
      if (!settled) { settled = true; process.stdin.destroy(); resolve(data); }
    }, 3000);
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => {
      if (!settled) { settled = true; clearTimeout(timer); resolve(data); }
    });
    process.stdin.on("error", () => {
      if (!settled) { settled = true; clearTimeout(timer); resolve(""); }
    });
  });
}

function initConfig(): void {
  const dest = resolve(process.env.HOME || "~", ".ai-ding.yaml");
  if (existsSync(dest)) {
    console.log(`Config already exists at ${dest}`);
    return;
  }

  const possiblePaths = [
    resolve(import.meta.dirname ?? ".", "..", "default-config.yaml"),
    resolve(import.meta.dirname ?? ".", "default-config.yaml"),
  ];

  let content = "";
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      content = readFileSync(p, "utf-8");
      break;
    }
  }

  if (!content) {
    content = `channels:
  desktop:
    enabled: true
  sound:
    enabled: true
    file: null
  ntfy:
    enabled: false
    url: ""
  telegram:
    enabled: false
    bot_token: ""
    chat_id: ""
  bark:
    enabled: false
    url: ""
    device_key: ""
  serverchan:
    enabled: false
    sendkey: ""
  slack:
    enabled: false
    webhook_url: ""
  email:
    enabled: false
    smtp_host: ""
    smtp_port: 587
    from: ""
    to: ""
    user: ""
    password: ""

remote:
  fallback_order:
    - sound
    - ntfy

defaults:
  message: "Task completed"
  title: "ai-ding"
`;
  }

  writeFileSync(dest, content, "utf-8");
  console.log(`Config created at ${dest}`);
}

program.parse();

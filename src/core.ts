import type { Config, Environment, Notifier } from "./notifiers/types.js";
import { DesktopNotifier } from "./notifiers/desktop.js";
import { SoundNotifier } from "./notifiers/sound.js";
import { NtfyNotifier } from "./notifiers/ntfy.js";
import { TelegramNotifier } from "./notifiers/telegram.js";
import { BarkNotifier } from "./notifiers/bark.js";
import { ServerChanNotifier } from "./notifiers/serverchan.js";
import { SlackNotifier } from "./notifiers/slack.js";
import { EmailNotifier } from "./notifiers/email.js";

function buildNotifiers(config: Config, env: Environment): Notifier[] {
  const notifiers: Notifier[] = [];
  const ch = config.channels;

  // Network notifiers: always fire if enabled, regardless of env
  if (ch.telegram.enabled && ch.telegram.bot_token && ch.telegram.chat_id) {
    notifiers.push(new TelegramNotifier(ch.telegram.bot_token, ch.telegram.chat_id));
  }
  if (ch.bark.enabled && ch.bark.url && ch.bark.device_key) {
    notifiers.push(new BarkNotifier(ch.bark.url, ch.bark.device_key));
  }
  if (ch.serverchan.enabled && ch.serverchan.sendkey) {
    notifiers.push(new ServerChanNotifier(ch.serverchan.sendkey));
  }
  if (ch.slack.enabled && ch.slack.webhook_url) {
    notifiers.push(new SlackNotifier(ch.slack.webhook_url));
  }
  if (ch.email.enabled && ch.email.smtp_host && ch.email.to) {
    notifiers.push(new EmailNotifier(ch.email));
  }

  // Local-only notifiers
  if (env === "local") {
    if (ch.desktop.enabled) notifiers.push(new DesktopNotifier());
    if (ch.sound.enabled) notifiers.push(new SoundNotifier());
  } else {
    // SSH/CI fallback
    for (const name of config.remote.fallback_order) {
      if (name === "sound" && ch.sound.enabled) notifiers.push(new SoundNotifier());
      if (name === "ntfy" && ch.ntfy.enabled && ch.ntfy.url) {
        notifiers.push(new NtfyNotifier(ch.ntfy.url));
      }
    }
  }

  return notifiers;
}

export async function dispatch(
  message: string,
  config: Config,
  env: Environment
): Promise<void> {
  const notifiers = buildNotifiers(config, env);
  const title = config.defaults.title;

  await Promise.allSettled(
    notifiers.map((n) =>
      n.send(message, { title }).catch((err) => {
        console.warn(`[notify-me] ${n.name} failed: ${err instanceof Error ? err.message : err}`);
        throw err;
      })
    )
  );
}

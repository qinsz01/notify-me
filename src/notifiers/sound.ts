import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { basename } from "node:path";
import type { Notifier, NotifyOptions, NotifyResult } from "./types.js";

const execFileAsync = promisify(execFile);

const DEFAULT_SOUND_FILES = [
  "/usr/share/sounds/freedesktop/stereo/complete.oga",
  "/usr/share/sounds/freedesktop/stereo/bell.oga",
  "/usr/share/sounds/freedesktop/stereo/message.oga",
];

export class SoundNotifier implements Notifier {
  name = "sound";
  private customFile: string | null;
  private _execFileAsync: (file: string, args: string[], opts?: { timeout?: number }) => Promise<{ stdout: string; stderr: string }>;

  constructor(
    customFile?: string | null,
    execFn?: (file: string, args: string[], opts?: { timeout?: number }) => Promise<{ stdout: string; stderr: string }>
  ) {
    this.customFile = customFile ?? null;
    this._execFileAsync = execFn ?? ((file, args, opts) => execFileAsync(file, args, opts));
  }

  async send(_message: string, _options?: NotifyOptions): Promise<NotifyResult> {
    // 1. Terminal bell — works over SSH if terminal supports it
    process.stdout.write("\x07");

    // 2. Try to play an audio file
    const audioResult = await this.playSound();

    if (audioResult) {
      return { channel: this.name, success: true, message: `terminal bell + audio (${audioResult})` };
    }
    return { channel: this.name, success: true, message: "terminal bell" };
  }

  private async playSound(): Promise<string | null> {
    // Use custom file if configured, otherwise try defaults
    const candidates = this.customFile ? [this.customFile] : DEFAULT_SOUND_FILES;
    const soundFile = candidates.find((f) => existsSync(f));
    if (!soundFile) return null;

    try {
      if (soundFile.endsWith(".oga")) {
        await this._execFileAsync("paplay", [soundFile], { timeout: 3000 });
      } else {
        await this._execFileAsync("aplay", [soundFile], { timeout: 3000 });
      }
      return basename(soundFile);
    } catch {
      return null;
    }
  }
}

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Notifier, NotifyOptions, NotifyResult } from "./types.js";

const defaultExecAsync = promisify(exec);

export class DesktopNotifier implements Notifier {
  name = "desktop";
  private execAsync: (command: string) => Promise<{ stdout: string; stderr: string }>;

  constructor(execAsync?: (command: string) => Promise<{ stdout: string; stderr: string }>) {
    this.execAsync = execAsync ?? defaultExecAsync;
  }

  async send(message: string, options?: NotifyOptions): Promise<NotifyResult> {
    const title = options?.title ?? "notify-me";

    try {
      if (process.platform === "darwin") {
        await this.execAsync(
          `osascript -e 'display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"'`
        );
      } else {
        const urgency = options?.urgency ?? "normal";
        await this.execAsync(`notify-send -u ${urgency} "${escapeShell(title)}" "${escapeShell(message)}"`);
      }
      return { channel: this.name, success: true, message: "desktop notification sent" };
    } catch (err) {
      return { channel: this.name, success: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
}

function escapeShell(s: string): string {
  return s.replace(/"/g, '\\"');
}

function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

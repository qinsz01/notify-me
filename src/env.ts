import type { Environment } from "./notifiers/types.js";

export function detectEnvironment(): Environment {
  if (process.env.CI) return "ci";
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return "ssh";
  if (process.env.DISPLAY || process.env.TERM_PROGRAM) return "local";
  return "local";
}

# notify-me Design Spec

## Problem

When using Claude Code or Codex CLI (often over SSH), users have no way to be notified when:
- AI finishes responding (Stop event)
- A long-running command completes
- User input is needed

This leads to constant context-switching and polling.

## Solution

A CLI notification tool (`notify-me`) packaged as a plugin for both Claude Code and Codex CLI. It sends notifications through multiple configurable channels: desktop notifications, sound, instant messaging (Telegram/Bark/Server酱/Slack), email, and network push services.

## Product Form

- **CLI tool**: Published to npm as `notify-me`, installable via `npm install -g notify-me`
- **Claude Code plugin**: With `.claude-plugin/plugin.json` manifest, hooks, and skills
- **Codex CLI plugin**: With `.codex-plugin/plugin.json` manifest, hooks, and skills
- Core logic is shared; platform-specific manifests wrap the same CLI

## Project Structure

```
notify-me/
├── package.json                    # npm package with CLI entry
├── src/
│   ├── cli.ts                      # CLI entry point (commander)
│   ├── core.ts                     # Core engine: parse config, dispatch to notifiers
│   ├── config.ts                   # Config file loading + CLI args merge
│   ├── env.ts                      # Environment detection (local/SSH/CI)
│   └── notifiers/
│       ├── types.ts                # Notifier interface
│       ├── desktop.ts              # OS desktop notification (notify-send / osascript)
│       ├── sound.ts                # Terminal bell + optional sound file
│       ├── ntfy.ts                 # ntfy.sh push (SSH remote fallback)
│       ├── telegram.ts             # Telegram Bot API
│       ├── bark.ts                 # Bark (iOS push)
│       ├── serverchan.ts           # Server酱 (WeChat push)
│       ├── slack.ts                # Slack Webhook
│       └── email.ts                # SMTP email
├── hooks/
│   └── hooks.json                  # Hook definitions for Stop event
├── skills/
│   └── notify/
│       └── SKILL.md                # Skill for AI to proactively notify
├── .claude-plugin/
│   └── plugin.json                 # Claude Code plugin manifest
├── .codex-plugin/
│   └── plugin.json                 # Codex CLI plugin manifest
├── default-config.yaml             # Default config template
└── tsconfig.json
```

## Notification Strategy

### Environment Detection

The tool detects its runtime environment:
- **Local desktop**: Has `DISPLAY` (Linux) or `TERM_PROGRAM` (macOS)
- **SSH session**: `SSH_CONNECTION` or `SSH_TTY` is set
- **CI**: `CI` env var is set

### Dispatch Logic

```
Notification request
  │
  ├─ Local desktop?
  │    ├─ Yes → Desktop notification (notify-send / osascript) + Sound
  │    └─ No (SSH/CI) → Fallback chain:
  │         ├─ Level 1: Terminal bell (\a) — zero config, always works
  │         ├─ Level 2: ntfy.sh push — one URL config, works everywhere
  │         └─ Level 3: Local relay — SSH reverse tunnel for full desktop popups
  │
  └─ Parallel: push to configured channels (Telegram/Bark/Slack/Email)
               regardless of local/remote status
```

### Notifier Interface

```typescript
interface Notifier {
  name: string;
  send(message: string, options?: NotifyOptions): Promise<void>;
}

interface NotifyOptions {
  title?: string;
  sound?: boolean;
  urgency?: 'low' | 'normal' | 'critical';
}
```

## CLI Usage

```bash
# Auto-detect environment, send via best available channel
notify-me "Build complete"

# Specify channel
notify-me --channel telegram "Build failed"

# Override config flags
notify-me --sound --no-desktop "Task done"

# Initialize config file
notify-me --init

# Test all configured channels
notify-me --test
```

## Hook Configuration

The plugin registers hooks for the `Stop` event (when AI finishes responding):

**Claude Code** (`hooks/hooks.json`):
```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/dist/cli.js \"Claude Code finished responding\""
          }
        ]
      }
    ]
  }
}
```

**Codex CLI** (similar pattern using Codex hooks format).

## Configuration

File: `~/.notify-me.yaml` (YAML for readability)

```yaml
channels:
  desktop:
    enabled: true
  sound:
    enabled: true
    file: null
  ntfy:
    enabled: false
    url: https://ntfy.sh/my-topic
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
  fallback_order: [sound, ntfy]

defaults:
  message: "Task completed"
  title: "notify-me"
```

CLI arguments override config file values. Environment variables can also be used: `NOTIFY_ME_TELEGRAM_BOT_TOKEN`, etc.

## Plugin Manifests

### Claude Code (`.claude-plugin/plugin.json`)

```json
{
  "name": "notify-me",
  "version": "1.0.0",
  "description": "Cross-platform notifications for Claude Code — desktop, sound, Telegram, Bark, Slack, email, and more.",
  "author": {
    "name": "notify-me contributors"
  },
  "license": "MIT",
  "keywords": ["notification", "alert", "telegram", "slack", "bark"],
  "hooks": "./hooks/hooks.json",
  "skills": "./skills/",
  "userConfig": {}
}
```

### Codex CLI (`.codex-plugin/plugin.json`)

```json
{
  "name": "notify-me",
  "version": "1.0.0",
  "description": "Cross-platform notifications for Codex CLI — desktop, sound, Telegram, Bark, Slack, email, and more.",
  "license": "MIT",
  "keywords": ["notification", "alert"],
  "skills": "./skills/"
}
```

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js 18+
- **CLI framework**: commander
- **Config parsing**: yaml (js-yaml)
- **HTTP requests**: native fetch (Node 18+)
- **Build**: tsup (esbuild-based, zero-config)
- **No external native dependencies** — all notifiers use HTTP APIs or built-in OS commands

## Error Handling

- If a notifier fails, log warning and continue to next notifier (fail-open, never block the user)
- Missing config for a channel = skip silently (only warn if explicitly requested via `--channel`)
- Hook execution timeout: 10 seconds max to avoid blocking AI workflow
- All network requests have 5-second timeout

## Installation

```bash
# Install globally
npm install -g notify-me

# Initialize config
notify-me --init

# Test notifications
notify-me --test

# In Claude Code: install as plugin
/plugin install notify-me@marketplace
```

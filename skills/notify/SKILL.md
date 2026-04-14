---
name: notify
description: Send a notification to the user via configured channels (desktop, sound, Telegram, Bark, Slack, email). Use when a long task completes or when you need the user's attention.
---

Send a notification to the user by running the CLI tool:

```bash
notify-me "<message>"
```

Examples:
- `notify-me "Build complete"` — send a simple notification
- `notify-me --channel telegram "Deploy failed"` — send to specific channel
- `notify-me --test` — test all configured channels

The user must have configured channels in `~/.notify-me.yaml` (run `notify-me --init` to create).

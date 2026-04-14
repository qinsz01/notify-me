---
name: notify
description: Send a notification to the user via configured channels (desktop, sound, Telegram, Bark, Slack, email). Use when a long task completes or when you need the user's attention.
---

Send a notification to the user by running the CLI tool:

```bash
notify-me "<message>"
```

**Important:** Always include a concise summary of what was accomplished or what needs attention in the message. Do not use generic messages like "Task completed" or "Done".

Examples:
- `notify-me "Fixed auth bug: session tokens now expire after 24h"` — descriptive message
- `notify-me --title "Build" "All 48 tests passed, pushed to master"` — with a custom title
- `notify-me --channel telegram "Deploy failed: connection refused on port 443"` — to specific channel
- `notify-me --test` — test all configured channels

The user must have configured channels in `~/.notify-me.yaml` (run `notify-me --init` to create).

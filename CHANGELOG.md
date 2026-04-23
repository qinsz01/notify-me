# Changelog

All notable changes to this project will be documented in this file.

## [1.1.1] - 2026-04-23

### Fixed
- Deduplicated Codex `Stop` notifications when repo-local and personal hook installs both receive the same turn event

## [1.1.0] - 2026-04-17

### Added
- Personal Codex installation via `ai-ding --install-codex`
- Personal Codex uninstall via `ai-ding --uninstall-codex`
- Repo-local Codex plugin marketplace at `.agents/plugins/marketplace.json`
- Repo-local Codex Stop hook at `.codex/hooks.json`
- Codex plugin interface metadata for richer marketplace presentation
- Codex installation and hook management tests

### Changed
- Completed Codex compatibility so `notify` can be installed as a plugin and Stop events can trigger notifications automatically
- Made hook execution safe for Codex by suppressing normal stdout logs during hook runs and returning a valid JSON response
- Routed hook-safe terminal bell output to `stderr` instead of `stdout`
- Updated Claude hook commands to pass explicit source metadata
- Expanded English and Chinese docs to cover repo-local and personal Codex installation flows

### Fixed
- Codex Stop hook notifications now work without relying on Claude-specific plugin root variables
- `notify` skill now documents both global CLI usage and in-repo `node dist/cli.js` usage

## [1.0.0] - 2026-04-15

### Added
- Desktop notifications for macOS (osascript) and Linux (notify-send)
- Sound alerts via terminal bell and audio file playback
- Telegram Bot notifications
- Bark (iOS push) notifications
- Server酱 (WeChat) notifications
- Slack webhook notifications
- Email notifications via SMTP
- ntfy.sh push notifications (recommended for SSH)
- SSH-aware environment detection with progressive fallback
- Contextual hook-mode notifications for Claude Code:
  - Stop: shows last assistant message summary
  - StopFailure: alerts on API errors (rate_limit, server_error, etc.)
  - AskUserQuestion: shows the question text
  - ExitPlanMode: alerts when plan is ready for approval
  - PermissionRequest: alerts on permission dialogs
  - Notification (idle_prompt/permission_prompt): alerts when waiting for input
  - Notification (other): forwards all other notification messages
- Per-channel success/failure feedback with ✓/✗ output
- `--title` and `--channel` CLI options
- `--hook` flag for stdin-based event processing
- `--init` to create default config file
- `--test` to verify all enabled channels
- Subagent event filtering (only notifies on user-facing actions)
- YAML config file (`~/.ai-ding.yaml`)
- Environment variable overrides (`AI_DING_*`)
- Claude Code plugin manifest
- Codex CLI plugin manifest
- Dual-language README (English + Chinese)

### Security
- Shell injection prevention via `execFile` with argument arrays
- Telegram chatId truncation in output to prevent info leak

# Contributing to ai-ding

Thanks for your interest! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/qinsz01/ai-ding.git
cd ai-ding
npm install
npm run build
npm test
```

## Development Workflow

1. Fork the repo and create a branch
2. Make your changes with tests
3. Ensure `npm run lint` and `npm test` pass
4. Open a PR with a clear description

## Adding a New Notification Channel

1. Create `src/notifiers/<channel>.ts` implementing the `Notifier` interface
2. Add config interface to `src/notifiers/types.ts`
3. Register in `src/core.ts` buildNotifiers()
4. Add env var mapping in `src/config.ts`
5. Add default config entry in `default-config.yaml` and `src/config.ts`
6. Write tests in `src/notifiers/<channel>.test.ts`
7. Update README with setup instructions

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `chore:` build/tooling changes
- `test:` test additions/changes

## Release Process

1. Update `version` in `package.json`
2. Update `CHANGELOG.md`
3. Commit and push to master
4. CI automatically publishes to npm and creates a GitHub Release

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  enableCodexHooksFeature,
  installCodex,
  uninstallCodex,
} from "./codex.js";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("enableCodexHooksFeature", () => {
  it("adds a features section when config is empty", () => {
    expect(enableCodexHooksFeature("")).toContain("[features]\ncodex_hooks = true");
  });

  it("turns an existing false value to true", () => {
    const input = `[features]\ncodex_hooks = false\n`;
    expect(enableCodexHooksFeature(input)).toContain("codex_hooks = true");
  });

  it("adds codex_hooks to an existing features section", () => {
    const input = `[features]\nmulti_agent = true\n`;
    const output = enableCodexHooksFeature(input);
    expect(output).toContain("[features]\nmulti_agent = true\ncodex_hooks = true");
  });
});

describe("installCodex / uninstallCodex", () => {
  let tmpDir: string;
  let homeDir: string;
  let packageRoot: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ai-ding-codex-${Date.now()}`);
    homeDir = join(tmpDir, "home");
    packageRoot = join(tmpDir, "package");

    mkdirSync(homeDir, { recursive: true });
    mkdirSync(join(packageRoot, ".codex-plugin"), { recursive: true });
    mkdirSync(join(packageRoot, "dist"), { recursive: true });
    mkdirSync(join(packageRoot, "skills", "notify"), { recursive: true });

    writeFileSync(
      join(packageRoot, ".codex-plugin", "plugin.json"),
      JSON.stringify({ name: "ai-ding", version: "1.0.0" }, null, 2)
    );
    writeFileSync(join(packageRoot, "dist", "cli.js"), "#!/usr/bin/env node\n");
    writeFileSync(join(packageRoot, "skills", "notify", "SKILL.md"), "---\nname: notify\n---\n");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("installs a personal Codex plugin source, marketplace entry, hooks, and feature flag", () => {
    installCodex({ homeDir, packageRoot });

    const pluginRoot = join(homeDir, ".codex", "plugins", "ai-ding");
    const marketplacePath = join(homeDir, ".agents", "plugins", "marketplace.json");
    const hooksPath = join(homeDir, ".codex", "hooks.json");
    const configPath = join(homeDir, ".codex", "config.toml");

    expect(existsSync(join(pluginRoot, ".codex-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(pluginRoot, "dist", "cli.js"))).toBe(true);
    expect(existsSync(join(pluginRoot, "skills", "notify", "SKILL.md"))).toBe(true);

    const marketplace = readJson(marketplacePath) as {
      plugins: Array<{ name: string; source: { path: string } }>;
    };
    expect(marketplace.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "ai-ding",
          source: expect.objectContaining({
            path: "./.codex/plugins/ai-ding",
          }),
        }),
      ])
    );

    const hooks = readJson(hooksPath) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> };
    };
    expect(hooks.hooks.Stop[0].hooks[0].command).toContain(
      'node "$HOME/.codex/plugins/ai-ding/dist/cli.js" --hook --source codex'
    );

    const config = readFileSync(configPath, "utf-8");
    expect(config).toContain("[features]");
    expect(config).toContain("codex_hooks = true");
  });

  it("preserves existing marketplace and hooks entries when installing", () => {
    mkdirSync(join(homeDir, ".agents", "plugins"), { recursive: true });
    mkdirSync(join(homeDir, ".codex"), { recursive: true });

    writeFileSync(
      join(homeDir, ".agents", "plugins", "marketplace.json"),
      JSON.stringify(
        {
          name: "local-plugins",
          interface: { displayName: "Local Plugins" },
          plugins: [
            {
              name: "existing-plugin",
              source: { source: "local", path: "./.codex/plugins/existing-plugin" },
              policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
              category: "Coding",
            },
          ],
        },
        null,
        2
      )
    );

    writeFileSync(
      join(homeDir, ".codex", "hooks.json"),
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                hooks: [
                  {
                    type: "command",
                    command: "echo existing-stop-hook",
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      )
    );

    installCodex({ homeDir, packageRoot });

    const marketplace = readJson(join(homeDir, ".agents", "plugins", "marketplace.json")) as {
      plugins: Array<{ name: string }>;
    };
    expect(marketplace.plugins.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["existing-plugin", "ai-ding"])
    );

    const hooks = readJson(join(homeDir, ".codex", "hooks.json")) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> };
    };
    const commands = hooks.hooks.Stop.flatMap((group) => group.hooks.map((hook) => hook.command));
    expect(commands).toEqual(
      expect.arrayContaining([
        "echo existing-stop-hook",
        expect.stringContaining('node "$HOME/.codex/plugins/ai-ding/dist/cli.js" --hook --source codex'),
      ])
    );
  });

  it("removes only ai-ding artifacts on uninstall", () => {
    mkdirSync(join(homeDir, ".agents", "plugins"), { recursive: true });
    mkdirSync(join(homeDir, ".codex", "plugins", "ai-ding"), { recursive: true });
    mkdirSync(join(homeDir, ".codex"), { recursive: true });

    writeFileSync(
      join(homeDir, ".agents", "plugins", "marketplace.json"),
      JSON.stringify(
        {
          name: "local-plugins",
          plugins: [
            {
              name: "existing-plugin",
              source: { source: "local", path: "./.codex/plugins/existing-plugin" },
              policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
              category: "Coding",
            },
            {
              name: "ai-ding",
              source: { source: "local", path: "./.codex/plugins/ai-ding" },
              policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
              category: "Productivity",
            },
          ],
        },
        null,
        2
      )
    );

    writeFileSync(
      join(homeDir, ".codex", "hooks.json"),
      JSON.stringify(
        {
          hooks: {
            Stop: [
              {
                hooks: [
                  {
                    type: "command",
                    command: "echo existing-stop-hook",
                  },
                  {
                    type: "command",
                    command: 'node "$HOME/.codex/plugins/ai-ding/dist/cli.js" --hook --source codex',
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      )
    );

    uninstallCodex({ homeDir });

    const marketplace = readJson(join(homeDir, ".agents", "plugins", "marketplace.json")) as {
      plugins: Array<{ name: string }>;
    };
    expect(marketplace.plugins).toEqual([
      expect.objectContaining({ name: "existing-plugin" }),
    ]);

    const hooks = readJson(join(homeDir, ".codex", "hooks.json")) as {
      hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> };
    };
    const commands = hooks.hooks.Stop.flatMap((group) => group.hooks.map((hook) => hook.command));
    expect(commands).toEqual(["echo existing-stop-hook"]);
    expect(existsSync(join(homeDir, ".codex", "plugins", "ai-ding"))).toBe(false);
  });
});

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const PLUGIN_NAME = "ai-ding";
const MARKETPLACE_RELATIVE_PATH = `./.codex/plugins/${PLUGIN_NAME}`;
const CODEx_PLUGIN_COMMAND = `node "$HOME/.codex/plugins/${PLUGIN_NAME}/dist/cli.js" --hook --source codex`;
const COPY_PATHS = [
  ".codex-plugin",
  "dist",
  "skills",
  "default-config.yaml",
  "README.md",
  "README.zh.md",
  "LICENSE",
  "CHANGELOG.md",
  "package.json",
];

type MarketplaceEntry = {
  name: string;
  source: {
    source: "local";
    path: string;
  };
  policy: {
    installation: "AVAILABLE";
    authentication: "ON_INSTALL";
  };
  category: string;
};

type MarketplaceFile = {
  name: string;
  interface?: {
    displayName?: string;
  };
  plugins: MarketplaceEntry[];
};

type HookHandler = {
  type: "command";
  command: string;
  timeout?: number;
  statusMessage?: string;
};

type HookGroup = {
  matcher?: string;
  hooks: HookHandler[];
};

type HooksFile = {
  hooks: Record<string, HookGroup[]>;
};

function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function createMarketplaceEntry(): MarketplaceEntry {
  return {
    name: PLUGIN_NAME,
    source: {
      source: "local",
      path: MARKETPLACE_RELATIVE_PATH,
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category: "Productivity",
  };
}

function createStopHookHandler(command = CODEx_PLUGIN_COMMAND): HookHandler {
  return {
    type: "command",
    command,
    timeout: 30,
    statusMessage: "Sending ai-ding notification",
  };
}

export function enableCodexHooksFeature(configToml: string): string {
  const lines = configToml.length > 0 ? configToml.replace(/\n+$/, "").split(/\r?\n/) : [];
  const output: string[] = [];
  let insideFeatures = false;
  let sawFeatures = false;
  let wroteFlag = false;

  for (const line of lines) {
    const isSection = /^\[.*\]\s*$/.test(line);

    if (/^\[features\]\s*$/.test(line)) {
      sawFeatures = true;
      insideFeatures = true;
      output.push(line);
      continue;
    }

    if (insideFeatures && isSection) {
      if (!wroteFlag) {
        output.push("codex_hooks = true");
        wroteFlag = true;
      }
      insideFeatures = false;
    }

    if (insideFeatures && /^\s*codex_hooks\s*=/.test(line)) {
      output.push("codex_hooks = true");
      wroteFlag = true;
      continue;
    }

    output.push(line);
  }

  if (insideFeatures && !wroteFlag) {
    output.push("codex_hooks = true");
    wroteFlag = true;
  }

  if (!sawFeatures) {
    if (output.length > 0 && output[output.length - 1] !== "") {
      output.push("");
    }
    output.push("[features]");
    output.push("codex_hooks = true");
  }

  return `${output.join("\n").replace(/\n+$/, "")}\n`;
}

function upsertMarketplace(path: string): void {
  const marketplace = readJsonFile<MarketplaceFile>(path, {
    name: "local-plugins",
    interface: { displayName: "Local Plugins" },
    plugins: [],
  });

  const entry = createMarketplaceEntry();
  const existingIndex = marketplace.plugins.findIndex((plugin) => plugin.name === PLUGIN_NAME);
  if (existingIndex >= 0) {
    marketplace.plugins[existingIndex] = entry;
  } else {
    marketplace.plugins.push(entry);
  }

  if (!marketplace.interface) {
    marketplace.interface = { displayName: "Local Plugins" };
  }

  writeJsonFile(path, marketplace);
}

function upsertHooks(path: string, command = CODEx_PLUGIN_COMMAND): void {
  const hooksFile = readJsonFile<HooksFile>(path, { hooks: {} });
  const stopGroups = hooksFile.hooks.Stop ?? [];
  const alreadyPresent = stopGroups.some((group) =>
    group.hooks.some((hook) => hook.command === command)
  );

  if (!alreadyPresent) {
    stopGroups.push({ hooks: [createStopHookHandler(command)] });
  }

  hooksFile.hooks.Stop = stopGroups;
  writeJsonFile(path, hooksFile);
}

function removeMarketplaceEntry(path: string): void {
  if (!existsSync(path)) return;
  const marketplace = readJsonFile<MarketplaceFile>(path, {
    name: "local-plugins",
    plugins: [],
  });
  marketplace.plugins = marketplace.plugins.filter((plugin) => plugin.name !== PLUGIN_NAME);
  writeJsonFile(path, marketplace);
}

function removeStopHook(path: string, command = CODEx_PLUGIN_COMMAND): void {
  if (!existsSync(path)) return;
  const hooksFile = readJsonFile<HooksFile>(path, { hooks: {} });
  const stopGroups = (hooksFile.hooks.Stop ?? [])
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((hook) => hook.command !== command),
    }))
    .filter((group) => group.hooks.length > 0);

  if (stopGroups.length > 0) {
    hooksFile.hooks.Stop = stopGroups;
  } else {
    delete hooksFile.hooks.Stop;
  }

  writeJsonFile(path, hooksFile);
}

function copyPluginSource(packageRoot: string, targetRoot: string): void {
  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });

  for (const relativePath of COPY_PATHS) {
    const sourcePath = join(packageRoot, relativePath);
    if (!existsSync(sourcePath)) continue;
    cpSync(sourcePath, join(targetRoot, relativePath), { recursive: true });
  }
}

export function installCodex(options: { homeDir: string; packageRoot: string }): void {
  const { homeDir, packageRoot } = options;
  const pluginRoot = join(homeDir, ".codex", "plugins", PLUGIN_NAME);
  const marketplacePath = join(homeDir, ".agents", "plugins", "marketplace.json");
  const hooksPath = join(homeDir, ".codex", "hooks.json");
  const configPath = join(homeDir, ".codex", "config.toml");

  copyPluginSource(packageRoot, pluginRoot);
  upsertMarketplace(marketplacePath);
  upsertHooks(hooksPath);

  const currentConfig = existsSync(configPath) ? readFileSync(configPath, "utf-8") : "";
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, enableCodexHooksFeature(currentConfig), "utf-8");
}

export function uninstallCodex(options: { homeDir: string }): void {
  const { homeDir } = options;
  const pluginRoot = join(homeDir, ".codex", "plugins", PLUGIN_NAME);
  const marketplacePath = join(homeDir, ".agents", "plugins", "marketplace.json");
  const hooksPath = join(homeDir, ".codex", "hooks.json");

  removeMarketplaceEntry(marketplacePath);
  removeStopHook(hooksPath);
  rmSync(pluginRoot, { recursive: true, force: true });
}

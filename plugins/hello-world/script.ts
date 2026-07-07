import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type InstalledPlugin = {
  name: string;
  source: string;
  entry: string;
  installedAt: string;
};

type PluginRegistry = {
  pluginPath: string;
  runtimePath: string;
  plugins: InstalledPlugin[];
};

const pluginDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(pluginDir, "../..");
const pluginPath = resolve(projectRoot, "plugins");
const runtimePath = resolve(projectRoot, "runtime");
const registryPath = resolve(runtimePath, "plugins.json");
const pluginName = basename(pluginDir);
const pluginEntry = "contract.ts";

async function readRegistry(): Promise<PluginRegistry> {
  if (!existsSync(registryPath)) {
    return {
      pluginPath: relative(projectRoot, pluginPath),
      runtimePath: relative(projectRoot, runtimePath),
      plugins: [],
    };
  }

  const rawRegistry = await readFile(registryPath, "utf8");
  const registry = JSON.parse(rawRegistry) as Partial<PluginRegistry>;

  return {
    pluginPath: registry.pluginPath ?? relative(projectRoot, pluginPath),
    runtimePath: registry.runtimePath ?? relative(projectRoot, runtimePath),
    plugins: Array.isArray(registry.plugins) ? registry.plugins : [],
  };
}

const registry = await readRegistry();
const installedPlugin: InstalledPlugin = {
  name: pluginName,
  source: relative(runtimePath, pluginDir),
  entry: pluginEntry,
  installedAt: new Date().toISOString(),
};

const nextRegistry: PluginRegistry = {
  ...registry,
  plugins: [
    ...registry.plugins.filter((plugin) => plugin.name !== pluginName),
    installedPlugin,
  ],
};

await mkdir(runtimePath, { recursive: true });
await writeFile(registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`);

console.log(`Installed ${pluginName}`);
console.log(`Runtime registry: ${registryPath}`);
console.log(`Runtime import: ${installedPlugin.source}/${pluginEntry}`);

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runtimePath, registryPath } from "./config";
import type { InstalledPlugin, PluginRegistry } from "../plugin";

export function readRegistry(): PluginRegistry {
  if (!existsSync(registryPath)) {
    return { plugins: [] };
  }

  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Partial<
    PluginRegistry
  >;

  return {
    plugins: Array.isArray(registry.plugins) ? registry.plugins : [],
  };
}

export function writeRegistry(registry: PluginRegistry) {
  mkdirSync(runtimePath, { recursive: true });
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}

export function upsertInstalledPlugin(installedPlugin: InstalledPlugin) {
  const registry = readRegistry();

  writeRegistry({
    plugins: [
      ...registry.plugins.filter(
        (plugin) => plugin.name !== installedPlugin.name,
      ),
      installedPlugin,
    ],
  });
}

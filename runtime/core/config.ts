import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const runtimePath = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const pluginInstallRoot = resolve(runtimePath, "plugins");
export const registryPath = resolve(runtimePath, "plugins.json");
export const port = Number(Bun.env.PORT ?? 3000);
export const pluginInstallTimeoutMs = resolvePluginInstallTimeoutMs();

function resolvePluginInstallTimeoutMs() {
  const timeoutMs = Number(Bun.env.PLUGIN_INSTALL_TIMEOUT_MS ?? 30_000);

  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30_000;
}

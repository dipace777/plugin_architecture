import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runtimePath } from "./config";
import type { InstalledPlugin, PluginContract } from "../plugin";

export function resolvePluginEntry(installedPlugin: InstalledPlugin) {
  const pluginSource = isAbsolute(installedPlugin.source)
    ? installedPlugin.source
    : resolve(runtimePath, installedPlugin.source);

  return resolve(pluginSource, installedPlugin.entry ?? "contract.ts");
}

export async function loadContract(
  installedPlugin: InstalledPlugin,
  cacheBust = false,
): Promise<PluginContract> {
  const resolvedContractPath = resolvePluginEntry(installedPlugin);
  const contractUrl = pathToFileURL(resolvedContractPath);

  if (cacheBust) {
    contractUrl.searchParams.set("installedAt", installedPlugin.installedAt);
  }

  const pluginModule = await import(contractUrl.href);
  const contract = pluginModule.default as PluginContract | undefined;

  if (!contract || !Array.isArray(contract.routes)) {
    throw new Error(`Invalid plugin contract: ${resolvedContractPath}`);
  }

  return contract;
}

export function summarizePlugin(contract: PluginContract) {
  return {
    name: contract.name,
    version: contract.version,
    description: contract.description,
    routes: contract.routes.map((route) => ({
      method: route.method,
      path: route.path,
    })),
  };
}

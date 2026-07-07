import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Effect, Layer } from "effect";
import { Hono } from "hono";
import type {
  InstalledPlugin,
  PluginContract,
  PluginHandlerValue,
  PluginRegistry,
  PluginRoute,
  PluginRouteHandler,
} from "./plugin";

const app = new Hono();
const runtimePath = dirname(fileURLToPath(import.meta.url));
const registryPath = resolve(runtimePath, "plugins.json");
const pluginLayer = Layer.merge(BunFileSystem.layer, BunPath.layer);
const port = Number(Bun.env.PORT ?? 3000);
type RunnablePluginEffect = Effect.Effect<PluginHandlerValue, unknown, never>;

process.chdir(runtimePath);

function readRegistry(): PluginRegistry {
  if (!existsSync(registryPath)) {
    return {
      pluginPath: "plugins",
      runtimePath: "runtime",
      plugins: [],
    };
  }

  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Partial<
    PluginRegistry
  >;

  return {
    pluginPath: registry.pluginPath ?? "plugins",
    runtimePath: registry.runtimePath ?? "runtime",
    plugins: Array.isArray(registry.plugins) ? registry.plugins : [],
  };
}

function toResponse(value: PluginHandlerValue) {
  if (value instanceof Response) {
    return value;
  }

  if (value === undefined) {
    return Response.json({ ok: true });
  }

  if (typeof value === "string") {
    return new Response(value, {
      headers: { "content-type": "text/plain; charset=UTF-8" },
    });
  }

  return Response.json(value);
}

async function resolveRouteValue(route: PluginRoute, context: Parameters<
  Extract<PluginRouteHandler, (...args: any[]) => unknown>
>[0]) {
  const result =
    typeof route.handler === "function" ? route.handler(context) : route.handler;

  if (Effect.isEffect(result)) {
    const runnable = Effect.provide(result, pluginLayer) as RunnablePluginEffect;

    return Effect.runPromise(runnable);
  }

  return result;
}

function resolvePluginEntry(installedPlugin: InstalledPlugin) {
  if (installedPlugin.contract) {
    return isAbsolute(installedPlugin.contract)
      ? installedPlugin.contract
      : resolve(runtimePath, installedPlugin.contract);
  }

  const pluginSource = isAbsolute(installedPlugin.source)
    ? installedPlugin.source
    : resolve(runtimePath, installedPlugin.source);

  return resolve(pluginSource, installedPlugin.entry ?? "contract.ts");
}

async function loadContract(
  installedPlugin: InstalledPlugin,
): Promise<PluginContract> {
  const resolvedContractPath = resolvePluginEntry(installedPlugin);
  const pluginModule = await import(pathToFileURL(resolvedContractPath).href);
  const contract = pluginModule.default as PluginContract | undefined;

  if (!contract || !Array.isArray(contract.routes)) {
    throw new Error(`Invalid plugin contract: ${resolvedContractPath}`);
  }

  return contract;
}

async function mountInstalledPlugins() {
  const registry = readRegistry();
  const mountedPlugins: PluginContract[] = [];

  for (const installedPlugin of registry.plugins) {
    const contract = await loadContract(installedPlugin);

    for (const route of contract.routes) {
      app.on(route.method, route.path, async (context) => {
        const value = await resolveRouteValue(route, context);
        return toResponse(value);
      });
    }

    mountedPlugins.push(contract);
  }

  return mountedPlugins;
}

const mountedPlugins = await mountInstalledPlugins();

app.get("/", (c) =>
  c.json({
    ok: true,
    plugins: mountedPlugins.map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      routes: plugin.routes.map((route) => ({
        method: route.method,
        path: route.path,
      })),
    })),
  }),
);

app.get("/plugins", (c) =>
  c.json(
    mountedPlugins.map((plugin) => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      routes: plugin.routes.map((route) => ({
        method: route.method,
        path: route.path,
      })),
    })),
  ),
);

export const serverConfig = {
  port,
  fetch: app.fetch,
};

export { app };

if (import.meta.main) {
  const server = Bun.serve(serverConfig);

  console.log(`Server listening on ${server.url}`);
}

import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import type { Context } from "hono";
import { loadContract, summarizePlugin } from "./contracts";
import type {
  InstalledPlugin,
  PluginContract,
  PluginHandlerValue,
  PluginRoute,
} from "../plugin";

const pluginLayer = Layer.merge(BunFileSystem.layer, BunPath.layer);
type RunnablePluginEffect = Effect.Effect<PluginHandlerValue, unknown, never>;

export function createPluginRouter() {
  const mountedPlugins = new Map<string, PluginContract>();

  function mount(contract: PluginContract) {
    mountedPlugins.set(contract.name, contract);
  }

  async function mountInstalled(installedPlugins: InstalledPlugin[]) {
    for (const installedPlugin of installedPlugins) {
      mount(await loadContract(installedPlugin));
    }
  }

  function summaries() {
    return Array.from(mountedPlugins.values(), summarizePlugin);
  }

  async function dispatch(context: Context) {
    const requestMethod = context.req.method.toUpperCase();
    const requestPath = context.req.path;

    for (const plugin of mountedPlugins.values()) {
      const route = plugin.routes.find(
        (candidate) =>
          candidate.method === requestMethod && candidate.path === requestPath,
      );

      if (route) {
        return toResponse(await resolveRouteValue(route, context));
      }
    }

    return context.json({ error: "Not found" }, 404);
  }

  return {
    dispatch,
    mount,
    mountInstalled,
    summaries,
  };
}

async function resolveRouteValue(route: PluginRoute, context: Context) {
  const result =
    typeof route.handler === "function" ? route.handler(context) : route.handler;

  if (Effect.isEffect(result)) {
    const runnable = Effect.provide(result, pluginLayer) as RunnablePluginEffect;

    return Effect.runPromise(runnable);
  }

  return result;
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

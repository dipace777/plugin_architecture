import type { Effect } from "effect";
import type { Context } from "hono";

export type PluginHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export type PluginHandlerValue =
  | Response
  | string
  | number
  | boolean
  | null
  | void
  | object;

export type PluginHandlerResult =
  | PluginHandlerValue
  | Promise<PluginHandlerValue>
  | Effect.Effect<PluginHandlerValue, unknown, unknown>;

export type PluginHandler = (context: Context) => PluginHandlerResult;
export type PluginRouteHandler = PluginHandler | PluginHandlerResult;

export type PluginRoute = {
  path: `/${string}`;
  method: PluginHttpMethod;
  handler: PluginRouteHandler;
};

export type PluginContract = {
  name: string;
  version: string;
  description?: string;
  routes: PluginRoute[];
};

export type InstalledPlugin = {
  name: string;
  source: string;
  entry?: string;
  contract?: string;
  installedAt: string;
};

export type PluginRegistry = {
  pluginPath: string;
  runtimePath: string;
  plugins: InstalledPlugin[];
};

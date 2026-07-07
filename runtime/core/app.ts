import { Hono } from "hono";
import { createPluginInstaller } from "./plugin-installer";
import { createPluginRouter } from "./plugin-router";
import { readRegistry } from "./registry";

export async function createRuntimeApp() {
  const app = new Hono();
  const pluginRouter = createPluginRouter();

  await pluginRouter.mountInstalled(readRegistry().plugins);

  const pluginInstaller = createPluginInstaller({
    onInstalled: pluginRouter.mount,
  });

  app.get("/", (context) =>
    context.json({
      ok: true,
      plugins: pluginRouter.summaries(),
    }),
  );

  app.get("/plugins", (context) => context.json(pluginRouter.summaries()));

  app.post("/plugins/install", async (context) => {
    try {
      const formData = await context.req.raw.formData();
      const executable = formData.get("executable");

      if (!(executable instanceof File)) {
        throw new Error("Plugin install request requires an executable file");
      }

      return context.json(await pluginInstaller.install(executable), 201);
    } catch (error) {
      return context.json(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    }
  });

  app.all("*", pluginRouter.dispatch);

  return app;
}

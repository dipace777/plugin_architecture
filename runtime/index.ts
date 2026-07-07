import { createRuntimeApp } from "./core/app";
import { port, runtimePath } from "./core/config";

process.chdir(runtimePath);

export const app = await createRuntimeApp();

export const serverConfig = {
  port,
  fetch: app.fetch,
};

if (import.meta.main) {
  const server = Bun.serve(serverConfig);

  console.log(`Server listening on ${server.url}`);
}

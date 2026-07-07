import { readFromAFile, writeToAFile } from "./services";
import type { PluginContract } from "../../runtime/plugin";

const CONTRACT = {
  name: "hello-world",
  version: "1.0.0",
  description: "A simple hello world plugin",
  routes: [
    {
      path: "/hello-world",
      method: "GET",
      handler: readFromAFile,
    },
    {
      path: "/hello-world",
      method: "POST",
      handler: writeToAFile,
    },
  ],
} satisfies PluginContract;

export default CONTRACT;

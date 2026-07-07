import { readFromAFile, writeToAFile } from "./services";

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
};

export default CONTRACT;

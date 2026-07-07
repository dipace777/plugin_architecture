import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";

const executablePath = resolveExecutablePath();
const runtimeUrl = getOption("--runtime-url") ?? Bun.env.RUNTIME_URL ?? "http://localhost:3000";
const installUrl = new URL("/plugins/install", runtimeUrl);

if (!existsSync(executablePath)) {
  fail(`Plugin executable was not found: ${executablePath}`);
}

const executable = Bun.file(executablePath);
const formData = new FormData();

formData.set("executable", executable, basename(executablePath));

const response = await fetch(installUrl, {
  method: "POST",
  body: formData,
});
const responseBody = await response.text();

if (!response.ok) {
  console.error(`Failed to install plugin executable: ${response.status}`);
  console.error(responseBody);
  process.exit(1);
}

console.log(responseBody);

function resolveExecutablePath() {
  const executablePathArg = Bun.argv.slice(2).find((arg, index, args) => {
    const previous = args[index - 1];

    return !arg.startsWith("--") && !optionTakesValue(previous);
  });

  if (!executablePathArg) {
    fail(
      [
        "Usage: bun scripts/install-plugin-executable.ts <executable-path>",
        "",
        "Options:",
        "  --runtime-url <url>  Runtime base URL. Defaults to RUNTIME_URL or http://localhost:3000",
      ].join("\n"),
    );
  }

  return resolve(executablePathArg);
}

function getOption(name: string) {
  const index = Bun.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  const value = Bun.argv[index + 1];

  if (!value || value.startsWith("--")) {
    fail(`Missing value for ${name}`);
  }

  return value;
}

function optionTakesValue(option: string | undefined) {
  return option === "--runtime-url";
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

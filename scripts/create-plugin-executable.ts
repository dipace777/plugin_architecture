import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

type PluginFiles = Record<string, string>;

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const pluginPath = resolvePluginPath();
const pluginName = getOption("--name") ?? basename(pluginPath);
const pluginEntry = getOption("--entry") ?? "contract.ts";
const outputDir = resolve(getOption("--out-dir") ?? "plugins-executable");
const outputPath = join(outputDir, `${pluginName}-plugin`);
const files = await collectPluginFiles(pluginPath);

assertSafePluginName(pluginName);

if (!files[pluginEntry]) {
  fail(`Plugin entry "${pluginEntry}" was not found in ${pluginPath}`);
}

await mkdir(outputDir, { recursive: true });

const tempDir = await mkdtemp(join(tmpdir(), "plugin-executable-"));
const installerPath = join(tempDir, `${pluginName}-installer.ts`);

try {
  await writeFile(
    installerPath,
    createInstallerSource({
      name: pluginName,
      entry: pluginEntry,
      files,
    }),
  );

  const result = Bun.spawnSync({
    cmd: ["bun", "build", "--compile", installerPath, "--outfile", outputPath],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr);
    const stdout = new TextDecoder().decode(result.stdout);

    fail([stdout, stderr].filter(Boolean).join("\n"));
  }

  console.log(`Created ${outputPath}`);
  console.log(`Bundled ${Object.keys(files).length} source file(s) from ${pluginPath}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function resolvePluginPath() {
  const pluginPathArg = Bun.argv
    .slice(2)
    .find((arg, index, args) => {
      const previous = args[index - 1];

      return !arg.startsWith("--") && !optionTakesValue(previous);
    });

  if (!pluginPathArg) {
    fail(
      [
        "Usage: bun scripts/create-plugin-executable.ts <plugin-path>",
        "",
        "Options:",
        "  --entry <file>    Plugin contract entry file. Defaults to contract.ts",
        "  --name <name>     Installed plugin name. Defaults to plugin directory name",
        "  --out-dir <dir>   Executable output directory. Defaults to plugins-executable",
      ].join("\n"),
    );
  }

  return resolve(pluginPathArg);
}

function getOption(name: string) {
  const index = Bun.argv.indexOf(name);

  return index === -1 ? undefined : Bun.argv[index + 1];
}

function optionTakesValue(option: string | undefined) {
  return option === "--entry" || option === "--name" || option === "--out-dir";
}

function assertSafePluginName(name: string) {
  if (
    name.length === 0 ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    fail(`Plugin name must be a directory-safe name: ${name}`);
  }
}

async function collectPluginFiles(root: string) {
  const files: PluginFiles = {};

  await visitDirectory(root, root, files);

  return files;
}

async function visitDirectory(root: string, directory: string, files: PluginFiles) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await visitDirectory(root, fullPath, files);
      continue;
    }

    if (!entry.isFile() || !textExtensions.has(extname(entry.name))) {
      continue;
    }

    const relativePath = relative(root, fullPath).split(sep).join("/");

    files[relativePath] = await readFile(fullPath, "utf8");
  }
}

function createInstallerSource(payload: {
  name: string;
  entry: string;
  files: PluginFiles;
}) {
  return `#!/usr/bin/env bun

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const payload = ${JSON.stringify(payload, null, 2)} as const;

if (Bun.env.PLUGIN_EXECUTABLE_MODE !== "install") {
  console.error("This plugin executable must be installed by the runtime.");
  console.error("Upload it with scripts/install-plugin-executable.ts or POST it to /plugins/install.");
  process.exit(1);
}

await installToRuntime();

async function installToRuntime() {
  const installRoot = Bun.env.PLUGIN_INSTALL_ROOT;

  if (!installRoot) {
    throw new Error("PLUGIN_INSTALL_ROOT is required in install mode");
  }

  const pluginRoot = resolve(installRoot, payload.name);

  await rm(pluginRoot, { recursive: true, force: true });

  for (const [path, contents] of Object.entries(payload.files)) {
    const targetPath = resolveSafeFilePath(pluginRoot, path);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, contents);
  }

  console.log(
    JSON.stringify({
      name: payload.name,
      entry: payload.entry,
    }),
  );
}

function resolveSafeFilePath(root: string, path: string) {
  const targetPath = resolve(root, path);
  const relativePath = relative(root, targetPath);

  if (
    path.length === 0 ||
    isAbsolute(path) ||
    relativePath.startsWith("..") ||
    relativePath === ".." ||
    relativePath.split(sep).includes("..")
  ) {
    throw new Error(\`Unsafe plugin file path: \${path}\`);
  }

  return targetPath;
}
`;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

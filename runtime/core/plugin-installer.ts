import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import {
  pluginInstallRoot,
  pluginInstallTimeoutMs,
  runtimePath,
} from "./config";
import { loadContract, summarizePlugin } from "./contracts";
import { upsertInstalledPlugin } from "./registry";
import type { InstalledPlugin, PluginContract } from "../plugin";

type PluginInstallMetadata = {
  name: string;
  entry?: string;
};

type PluginExecutableResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

type PluginInstallerOptions = {
  onInstalled: (contract: PluginContract) => void;
};

export function createPluginInstaller({ onInstalled }: PluginInstallerOptions) {
  let installQueue: Promise<unknown> = Promise.resolve();

  function enqueueInstall<T>(operation: () => Promise<T>) {
    const queued = installQueue.then(operation, operation);

    installQueue = queued.catch(() => undefined);

    return queued;
  }

  return {
    install(executable: File) {
      return enqueueInstall(() =>
        installPluginFromExecutable(executable, onInstalled),
      );
    },
  };
}

async function installPluginFromExecutable(
  executable: File,
  onInstalled: (contract: PluginContract) => void,
) {
  const executableName = sanitizeExecutableName(executable.name);
  const tempDir = mkdtempSync(resolve(runtimePath, ".plugin-install-"));
  const executablePath = resolve(tempDir, executableName);

  try {
    writeFileSync(executablePath, new Uint8Array(await executable.arrayBuffer()));
    chmodSync(executablePath, 0o755);
    mkdirSync(pluginInstallRoot, { recursive: true });

    const result = await runPluginExecutable(executablePath);

    if (result.exitCode !== 0) {
      throw new Error(
        result.stderr.trim() ||
          result.stdout.trim() ||
          `Plugin executable failed with exit code ${result.exitCode}`,
      );
    }

    const metadata = parseInstallMetadata(result.stdout);

    assertSafeDirectoryName(metadata.name);

    const entry = metadata.entry ?? "contract.ts";
    const pluginSource = resolve(pluginInstallRoot, metadata.name);
    const pluginToLoad: InstalledPlugin = {
      name: metadata.name,
      source: relative(runtimePath, pluginSource),
      entry,
      installedAt: new Date().toISOString(),
    };
    const contract = await loadContract(pluginToLoad, true);

    if (contract.name !== metadata.name) {
      throw new Error(
        `Plugin contract name "${contract.name}" does not match installed plugin "${metadata.name}"`,
      );
    }

    const installedPlugin: InstalledPlugin = {
      ...pluginToLoad,
      name: contract.name,
    };

    upsertInstalledPlugin(installedPlugin);
    onInstalled(contract);

    return {
      installed: installedPlugin,
      plugin: summarizePlugin(contract),
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function assertSafeDirectoryName(name: string) {
  const resolvedPath = resolve(pluginInstallRoot, name);
  const relativePath = relative(pluginInstallRoot, resolvedPath);

  if (
    name.length === 0 ||
    name === "." ||
    name === ".." ||
    isAbsolute(name) ||
    relativePath.startsWith("..") ||
    relativePath === ".." ||
    relativePath.split(sep).includes("..") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error(`Unsafe plugin name: ${name}`);
  }
}

function sanitizeExecutableName(name: string) {
  const safeName = basename(name).replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName.length === 0 ? "plugin-executable" : safeName;
}

function parseInstallMetadata(stdout: string): PluginInstallMetadata {
  const metadataLine = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (!metadataLine) {
    throw new Error("Plugin executable did not return install metadata");
  }

  const metadata = parseJsonObject(metadataLine);

  if (typeof metadata.name !== "string" || metadata.name.length === 0) {
    throw new Error("Plugin executable metadata requires a non-empty name");
  }

  if (metadata.entry !== undefined && typeof metadata.entry !== "string") {
    throw new Error("Plugin executable metadata entry must be a string");
  }

  return {
    name: metadata.name,
    entry: metadata.entry,
  };
}

function parseJsonObject(value: string) {
  const parsed = JSON.parse(value) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Plugin executable metadata must be a JSON object");
  }

  return parsed as Partial<PluginInstallMetadata>;
}

async function runPluginExecutable(
  executablePath: string,
): Promise<PluginExecutableResult> {
  const subprocess = Bun.spawn({
    cmd: [executablePath],
    cwd: runtimePath,
    env: {
      ...Bun.env,
      PLUGIN_EXECUTABLE_MODE: "install",
      PLUGIN_INSTALL_ROOT: pluginInstallRoot,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    subprocess.kill("SIGKILL");
  }, pluginInstallTimeoutMs);

  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      subprocess.exited,
      streamToText(subprocess.stdout),
      streamToText(subprocess.stderr),
    ]);

    if (timedOut) {
      throw new Error(
        `Plugin executable timed out after ${pluginInstallTimeoutMs}ms`,
      );
    }

    return { exitCode, stdout, stderr };
  } finally {
    clearTimeout(timeout);
  }
}

function streamToText(stream: ReadableStream<Uint8Array> | null) {
  return stream ? new Response(stream).text() : "";
}

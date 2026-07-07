# plugin_architecture

A Bun runtime that can install plugins from self-contained executables.

The plugin source can live outside the runtime repository. A plugin repo builds
an executable artifact, a client uploads that executable to the runtime install
API, and the runtime executes it in install mode to materialize source under
`runtime/plugins/<plugin-name>`.

## Install

```bash
bun install
```

## Run The Runtime

```bash
bun run runtime
```

The runtime starts on `PORT` or `3000` by default.

## Build And Install A Plugin

Build the hello-world plugin executable:

```bash
bun run build:plugin -- plugins/hello-world
```

Install the executable into the runtime:

```bash
bun run install:plugin -- plugins-executable/hello-world-plugin
```

To install into another runtime:

```bash
bun run install:plugin -- plugins-executable/hello-world-plugin --runtime-url http://localhost:3000
```

You can also set `RUNTIME_URL`:

```bash
RUNTIME_URL=http://localhost:3000 bun run install:plugin -- plugins-executable/hello-world-plugin
```

After installation:

```bash
curl -X POST http://localhost:3000/hello-world
curl http://localhost:3000/hello-world
curl http://localhost:3000/plugins
```

## Plugin Install Flow

1. `scripts/create-plugin-executable.ts` bundles a plugin directory into a Bun executable.
2. `scripts/install-plugin-executable.ts` uploads that executable as multipart field `executable` to `POST /plugins/install`.
3. The runtime saves the uploaded executable to a temp path.
4. The runtime executes it with:
   - `PLUGIN_EXECUTABLE_MODE=install`
   - `PLUGIN_INSTALL_ROOT=<runtime>/plugins`
5. The executable writes its bundled source files into `runtime/plugins/<plugin-name>`.
6. The executable prints install metadata as JSON.
7. The runtime imports the plugin contract and mounts its routes.

The generated executable is an install artifact. Direct execution outside the
runtime fails intentionally.

## Scripts

```bash
bun run build:plugin -- <plugin-path>
bun run install:plugin -- <plugin-executable-path>
bun run runtime
bun run typecheck
```

## Runtime Architecture

`runtime/index.ts` is only the bootstrap. Runtime logic lives in `runtime/core`:

- `app.ts`: Hono routes and runtime wiring.
- `config.ts`: runtime paths, port, and install timeout.
- `registry.ts`: installed plugin registry persistence.
- `contracts.ts`: plugin contract loading and summary shape.
- `plugin-installer.ts`: executable upload install flow, timeout, queue, and metadata validation.
- `plugin-router.ts`: mounted plugin dispatch and Effect execution.

Shared plugin contract types live in `runtime/plugin.ts`.

## Runtime State

These paths are generated runtime state and ignored by Git:

- `plugins-executable`
- `runtime/plugins`
- `runtime/plugins.json`
- `runtime/.plugin-install-*`
- `runtime/plugin-artifacts`

## Configuration

- `PORT`: runtime port. Defaults to `3000`.
- `RUNTIME_URL`: install script target runtime. Defaults to `http://localhost:3000`.
- `PLUGIN_INSTALL_TIMEOUT_MS`: executable install timeout. Defaults to `30000`.

## Create Another Plugin Executable

```bash
bun run build:plugin -- plugins/my-plugin
bun run install:plugin -- plugins-executable/my-plugin-plugin
```

By default, the installed plugin name comes from the plugin directory name. You
can override build behavior with:

```bash
bun scripts/create-plugin-executable.ts plugins/my-plugin --name my-plugin --entry contract.ts --out-dir plugins-executable
```

This project was created using `bun init` in bun v1.3.14.

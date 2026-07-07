# Security Notes

This runtime currently supports **trusted plugin installation**. It is not safe
to expose plugin installation as a public endpoint without additional controls.

## Current Install Model

1. A plugin directory is bundled into a self-contained executable with
   `scripts/create-plugin-executable.ts`.
2. A client uploads that executable to `POST /plugins/install` with
   `scripts/install-plugin-executable.ts`.
3. The runtime writes the executable to a temporary path.
4. The runtime executes it with:
   - `PLUGIN_EXECUTABLE_MODE=install`
   - `PLUGIN_INSTALL_ROOT=<runtime>/plugins`
5. The executable writes plugin source files into `runtime/plugins/<plugin-name>`.
6. The runtime imports the installed plugin contract and mounts its routes.

This design intentionally gives the runtime the ability to execute installer
code. That makes installation powerful, but it also makes installation the main
security boundary.

## Trust Boundary

Anyone who can call `POST /plugins/install` can cause the runtime host to
execute uploaded code. Treat that route as an admin-only operation.

Installed plugin contracts and route handlers run inside the runtime process.
They are not sandboxed from the runtime, its dependencies, or its process
environment.

## Existing Controls

- Plugin installs are queued in-process to avoid registry write races.
- Installer execution has a timeout controlled by `PLUGIN_INSTALL_TIMEOUT_MS`.
- Plugin names are validated before the runtime imports installed source.
- Generated plugin executables validate bundled file paths before writing files.
- Runtime install state is ignored by Git:
  - `runtime/plugins`
  - `runtime/plugins.json`
  - `runtime/.plugin-install-*`
  - `runtime/plugin-artifacts`

These controls reduce accidental breakage, but they do not make untrusted plugin
execution safe.

## Security Risks

### Arbitrary Code Execution

The uploaded executable is run by the runtime. A malicious executable can read
files, write files, spawn processes, make network requests, or modify runtime
state with the privileges of the runtime process.

### No Install Authentication

`POST /plugins/install` does not currently enforce authentication or
authorization. If the runtime is reachable by an attacker, the attacker can
attempt plugin installation.

### No Process Sandbox

Installers run as normal child processes. They are not isolated with a container,
restricted OS user, seccomp profile, chroot, VM, or filesystem/network policy.

### Environment Exposure

The runtime currently passes its environment into the installer process. Secrets
available to the runtime process may also be available to plugin installers.

### Runtime Process Exposure

After installation, plugin source is imported into the runtime process. Plugin
module top-level code and route handlers can affect process memory, globals,
dependencies, and runtime behavior.

### Upload And Output Resource Exhaustion

The runtime reads the uploaded executable into memory and captures installer
stdout/stderr. Very large uploads or very noisy installers can consume memory.

### Artifact Integrity

The runtime does not currently verify executable signatures, checksums,
publisher identity, or provenance.

### Route Conflicts

Multiple plugins can define the same method and path. The runtime should reject
or explicitly resolve route conflicts during install.

## Minimum Hardening Before Non-Local Use

- Require admin authentication for `POST /plugins/install`.
- Restrict the install endpoint to trusted networks or internal control planes.
- Enforce upload size limits.
- Limit captured stdout/stderr size.
- Pass an environment allowlist to installers instead of the full runtime env.
- Require signed plugin executables or checksum allowlisting.
- Reject route conflicts at install time.
- Run installers as a restricted OS user or inside a container.
- Consider running plugin route handlers in a separate process if plugins are
  not fully trusted.
- Log install attempts, installer metadata, and install outcomes.

## Recommended Production Direction

For a production-grade plugin system, prefer this model:

1. Build plugins in a separate trusted build environment.
2. Sign plugin artifacts after build.
3. Upload artifacts through an authenticated admin API.
4. Verify signature and expected publisher before execution.
5. Execute installers in a sandbox with a minimal environment.
6. Import or run installed plugins only after route and contract validation.

Until these controls exist, only install plugins from fully trusted sources.

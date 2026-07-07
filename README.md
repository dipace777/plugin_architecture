# plugin_architecture

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run install:hello-world
bun run runtime
```

The runtime exposes installed plugin routes as a REST API. After installing the
hello-world plugin:

```bash
curl -X POST http://localhost:3000/hello-world
curl http://localhost:3000/hello-world
curl http://localhost:3000/plugins
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

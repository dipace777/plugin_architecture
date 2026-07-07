import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

const artifactPaths = Effect.gen(function* () {
  const path = yield* Path.Path;
  const artifactDir = path.join("plugin-artifacts", "hello-world");
  const artifactPath = path.join(artifactDir, "hello-world.txt");

  return { artifactDir, artifactPath };
});

export const writeToAFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const { artifactDir, artifactPath } = yield* artifactPaths;

  yield* fs.makeDirectory(artifactDir, { recursive: true });
  yield* fs.writeFileString(artifactPath, "Hello World from Plugin");
});

export const readFromAFile = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const { artifactPath } = yield* artifactPaths;

  return yield* fs.readFileString(artifactPath);
});

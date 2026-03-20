import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

const packageDir = process.cwd();
const rootDir = resolve(packageDir, "../..");
const packageName = packageDir.split("/").at(-1) ?? "package";
const packageTsconfigPath = resolve(packageDir, "tsconfig.json");

const nodePackages = new Set([
  "create-ggez",
  "dev-sync",
  "game-dev",
  "runtime-build"
]);

function resolveEntry(...candidates) {
  for (const candidate of candidates) {
    const absolutePath = resolve(packageDir, candidate);

    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return undefined;
}

const libraryEntries = {};
const cliEntries = {};

const indexEntry = resolveEntry("src/index.ts", "src/index.js");
const nodeEntry = resolveEntry("src/node.ts", "src/node.js");
const cliEntry = resolveEntry("src/cli.ts", "src/cli.js");

if (indexEntry) {
  libraryEntries.index = indexEntry;
}

if (nodeEntry) {
  libraryEntries.node = nodeEntry;
}

if (cliEntry) {
  cliEntries.cli = cliEntry;
}

const hasTypeScriptLibraryEntries = Object.values(libraryEntries).some((entry) => /\.(ts|tsx)$/.test(entry));
const platform = nodePackages.has(packageName) ? "node" : "neutral";

export default defineConfig([
  Object.keys(libraryEntries).length > 0
    ? {
        bundle: true,
        clean: true,
        dts: hasTypeScriptLibraryEntries
          ? {
              tsconfig: existsSync(packageTsconfigPath)
                ? packageTsconfigPath
                : resolve(rootDir, "tsconfig.packages.json")
            }
          : false,
        entry: libraryEntries,
        format: ["esm"],
        outDir: "dist",
        platform,
        skipNodeModulesBundle: true,
        sourcemap: true,
        splitting: false,
        target: "es2022"
      }
    : undefined,
  Object.keys(cliEntries).length > 0
    ? {
        bundle: true,
        clean: Object.keys(libraryEntries).length === 0,
        dts: false,
        entry: cliEntries,
        format: ["esm"],
        outDir: "dist",
        platform: "node",
        skipNodeModulesBundle: true,
        sourcemap: true,
        splitting: false,
        target: "es2022"
      }
    : undefined
].filter(Boolean));
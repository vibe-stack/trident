import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..");
const packagesDir = resolve(rootDir, "packages");

const command = process.argv[2] ?? "build";
const dryRun = process.argv.includes("--dry-run");

const packages = loadPackages();
const orderedPackages = sortPackages(packages);

switch (command) {
  case "build": {
    for (const pkg of orderedPackages) {
      run("bun", ["run", "--cwd", pkg.dir, "build"], rootDir);
    }
    break;
  }
  case "publish": {
    for (const pkg of orderedPackages) {
      run("bun", ["run", "--cwd", pkg.dir, "build"], rootDir);
    }

    for (const pkg of orderedPackages) {
      const args = ["publish"];

      if (dryRun) {
        args.push("--dry-run");
      }

      if (pkg.name.startsWith("@")) {
        args.push("--access", "public");
      }

      run("npm", args, pkg.dir);
    }
    break;
  }
  default:
    throw new Error(`Unsupported command: ${command}`);
}

function loadPackages() {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(packagesDir, entry.name);
      const manifestPath = join(dir, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

      return {
        dependencies: collectInternalDependencies(manifest),
        dir,
        name: manifest.name,
        version: manifest.version
      };
    });
}

function collectInternalDependencies(manifest) {
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {})
  ].filter((dependencyName) => dependencyName === "create-web-hammer" || dependencyName.startsWith("@ggez/"));
}

function sortPackages(packagesToSort) {
  const packageMap = new Map(packagesToSort.map((pkg) => [pkg.name, pkg]));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];

  for (const pkg of packagesToSort) {
    visit(pkg);
  }

  return ordered;

  function visit(pkg) {
    if (visited.has(pkg.name)) {
      return;
    }

    if (visiting.has(pkg.name)) {
      throw new Error(`Circular package dependency detected at ${pkg.name}`);
    }

    visiting.add(pkg.name);

    for (const dependencyName of pkg.dependencies) {
      const dependencyPackage = packageMap.get(dependencyName);

      if (dependencyPackage) {
        visit(dependencyPackage);
      }
    }

    visiting.delete(pkg.name);
    visited.add(pkg.name);
    ordered.push(pkg);
  }
}

function run(binary, args, cwd) {
  const result = spawnSync(binary, args, {
    cwd,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
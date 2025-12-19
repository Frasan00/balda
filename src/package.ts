import { execSync } from "node:child_process";
import * as readline from "node:readline";
import { nativeFs } from "./runtime/native_fs.js";
import { nativePath } from "./runtime/native_path.js";

/**
 * Check if packages are already installed in node_modules
 */
export const getUninstalledPackages = async (
  packages: string[],
): Promise<string[]> => {
  const nodeModulesPath = nativePath.join(process.cwd(), "node_modules");
  const hasNodeModules = await nativeFs.exists(nodeModulesPath);

  if (!hasNodeModules) {
    return packages;
  }

  const uninstalled: string[] = [];

  for (const pkg of packages) {
    const pkgPath = nativePath.join(nodeModulesPath, pkg);
    const isInstalled = await nativeFs.exists(pkgPath);

    if (!isInstalled) {
      uninstalled.push(pkg);
    }
  }

  return uninstalled;
};

export const getPackageManager = async (): Promise<
  [string, string, string]
> => {
  const hasYarnLock = await nativeFs.exists(
    nativePath.join(process.cwd(), "yarn.lock"),
  );

  if (hasYarnLock) {
    return ["yarn", "add", "-D"];
  }

  const hasPnpmLock = await nativeFs.exists(
    nativePath.join(process.cwd(), "pnpm-lock.yaml"),
  );

  if (hasPnpmLock) {
    return ["pnpm", "add", "-D"];
  }

  const hasPackageLock = await nativeFs.exists(
    nativePath.join(process.cwd(), "package-lock.json"),
  );

  if (hasPackageLock) {
    return ["npm", "install", "-D"];
  }

  const hasBunLock = await nativeFs.exists(
    nativePath.join(process.cwd(), "bun.lockb"),
  );

  if (hasBunLock) {
    return ["bun", "add", "-D"];
  }

  const hasDenoLock = await nativeFs.exists(
    nativePath.join(process.cwd(), "deno.lock"),
  );

  if (hasDenoLock) {
    return ["deno", "add", "-D"];
  }

  return ["npm", "install", "-D"];
};

/**
 * Prompts user for confirmation and executes a command if approved
 * @param command - The command to execute
 * @param packageManager - The package manager name (e.g., "npm", "yarn")
 * @param dependencies - Array of dependencies to display
 * @param options - execSync options
 * @returns Promise that resolves to true if executed, false if skipped
 */
export const execWithPrompt = async (
  command: string,
  packageManager: string,
  dependencies: string[],
  options?: Parameters<typeof execSync>[1],
  areDevDeps: boolean = true,
): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const dependenciesList = dependencies.join(", ");
  const prompt = `Do you want to install the following ${areDevDeps ? "dev" : ""} dependencies using ${packageManager}?\n${dependenciesList}\n(y/n): `;

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();

      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        execSync(command, options);
        resolve(true);
        return;
      }

      resolve(false);
    });
  });
};

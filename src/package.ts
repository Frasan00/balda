import { nativeFs } from "./runtime/native_fs.js";
import { nativePath } from "./runtime/native_path.js";

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

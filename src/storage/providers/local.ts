import { BaldaError } from "../../errors/balda_error.js";
import { FileNotFoundError } from "../../errors/file_not_found_error.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import type {
  ReturnType,
  ReturnTypeMap,
  StorageInterface,
} from "../storage_types.js";

export type LocalStorageProviderOptions = {
  /**
   * The directory to store the files
   */
  directory: string;
};

/**
 * Local storage provider, stores files in the local filesystem
 * Note: This provider does not support signed URLs (getDownloadUrl/getUploadUrl)
 */
export class LocalStorageProvider implements StorageInterface {
  private wasDirectoryEnsured: boolean = false;
  constructor(private readonly options: LocalStorageProviderOptions) {}

  async getDownloadUrl(
    _key: string,
    _expiresInSeconds = 3600,
  ): Promise<string> {
    throw new BaldaError(
      "LocalStorageProvider does not support getDownloadUrl. Use S3 or Azure Blob storage for signed URLs.",
    );
  }

  async getUploadUrl(_key: string, _expiresInSeconds = 3600): Promise<string> {
    throw new BaldaError(
      "LocalStorageProvider does not support getUploadUrl. Use S3 or Azure Blob storage for signed URLs.",
    );
  }

  async getPublicUrl(_key: string): Promise<string> {
    throw new BaldaError(
      "`getPublicUrl` is not available in local storage provider",
    );
  }

  async listObjects(prefix?: string): Promise<string[]> {
    if (!this.wasDirectoryEnsured) {
      await this.ensureDirectoryExists();
    }

    const basePath = nativePath.resolve(this.options.directory);
    const searchPath = prefix ? nativePath.join(basePath, prefix) : basePath;

    const exists = await nativeFs.exists(searchPath);
    if (!exists) {
      return [];
    }

    const files: string[] = [];
    await this.listFilesRecursively(searchPath, basePath, files);
    return files;
  }

  async getObject<R extends ReturnType = "raw">(
    key: string,
    returnType: R = "raw" as R,
  ): Promise<ReturnTypeMap<R>> {
    if (!this.wasDirectoryEnsured) {
      await this.ensureDirectoryExists();
    }

    const filePath = nativePath.join(this.options.directory, key);
    const exists = await nativeFs.exists(filePath);
    if (!exists) {
      throw new FileNotFoundError(key);
    }

    const type = returnType as ReturnType;
    switch (type) {
      case "raw": {
        return (await nativeFs.readFile(filePath)) as ReturnTypeMap<R>;
      }
      case "text": {
        return (await nativeFs.readFile(filePath, {
          encoding: "utf8",
        })) as ReturnTypeMap<R>;
      }
      case "stream": {
        return (await nativeFs.streamFile(filePath)) as ReturnTypeMap<R>;
      }
      default: {
        throw new BaldaError("Invalid return type");
      }
    }
  }

  async putObject<T = Uint8Array>(
    key: string,
    value: T,
    _contentType?: string,
  ): Promise<void> {
    if (!this.wasDirectoryEnsured) {
      await this.ensureDirectoryExists();
    }

    const filePath = nativePath.join(this.options.directory, key);
    const dirPath = nativePath.join(filePath, "..");

    await nativeFs.mkdir(dirPath, { recursive: true });
    await nativeFs.writeFile(filePath, value as Uint8Array);
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.wasDirectoryEnsured) {
      await this.ensureDirectoryExists();
    }

    const filePath = nativePath.join(this.options.directory, key);
    const exists = await nativeFs.exists(filePath);

    if (exists) {
      await nativeFs.unlink(filePath);
    }
  }

  private async listFilesRecursively(
    currentPath: string,
    basePath: string,
    files: string[],
  ): Promise<void> {
    const stats = await nativeFs.stat(currentPath);

    if (stats.isFile) {
      const relativePath = currentPath.replace(basePath, "").replace(/^\//, "");
      files.push(relativePath);
      return;
    }

    if (!stats.isDirectory) {
      return;
    }

    const entries = await this.readDirectory(currentPath);
    for (const entry of entries) {
      const fullPath = nativePath.join(currentPath, entry);
      await this.listFilesRecursively(fullPath, basePath, files);
    }
  }

  private async readDirectory(path: string): Promise<string[]> {
    const { runtime } = await import("../../runtime/runtime.js");

    switch (runtime.type) {
      case "node": {
        const fs = await import("fs/promises");
        return await fs.readdir(path);
      }
      case "bun": {
        const fs = await import("fs/promises");
        return await fs.readdir(path);
      }
      case "deno": {
        const entries: string[] = [];
        for await (const entry of Deno.readDir(path)) {
          entries.push(entry.name);
        }
        return entries;
      }
      default:
        throw new BaldaError("Unsupported runtime");
    }
  }

  private async ensureDirectoryExists() {
    if (await nativeFs.exists(this.options.directory)) {
      this.wasDirectoryEnsured = true;
      return;
    }

    await nativeFs.mkdir(this.options.directory, { recursive: true });
    this.wasDirectoryEnsured = true;
  }
}

import type {
  ReturnType,
  ReturnTypeMap,
  StorageInterface,
  StorageOptions,
  StorageProviderOptions,
} from "./storage_types.js";

export class Storage<
  T extends StorageProviderOptions,
> implements StorageInterface {
  private readonly providerOptions: T;
  private readonly defaultProvider: keyof T;
  private readonly providerMap: Map<keyof T, StorageInterface>;

  constructor(providerOptions: T, storageOptions: StorageOptions<T>) {
    this.providerOptions = providerOptions;
    this.defaultProvider = storageOptions.defaultProvider;
    this.providerMap = new Map(
      Object.entries(providerOptions).map(([key, value]) => [key, value]),
    );
  }

  /**
   * Use a specific provider
   * @param provider - The provider to use
   * @returns The storage instance
   */
  use(provider: keyof T): StorageInterface {
    const providerInstance = this.providerMap.get(provider);
    if (!providerInstance) {
      throw new Error(`[Storage] Provider ${String(provider)} not found`);
    }

    return providerInstance as StorageInterface;
  }

  async getDownloadUrl(
    key: string,
    expiresInSeconds?: number,
  ): Promise<string> {
    const provider = this.providerOptions[
      this.defaultProvider
    ] as StorageInterface;
    return provider.getDownloadUrl(key, expiresInSeconds);
  }

  async getUploadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const provider = this.providerOptions[
      this.defaultProvider
    ] as StorageInterface;
    return provider.getUploadUrl(key, expiresInSeconds);
  }

  async getPublicUrl(key: string): Promise<string> {
    const provider = this.providerOptions[
      this.defaultProvider
    ] as StorageInterface;
    return provider.getPublicUrl(key);
  }

  async listObjects(prefix?: string): Promise<string[]> {
    const provider = this.providerOptions[
      this.defaultProvider
    ] as StorageInterface;
    return provider.listObjects(prefix);
  }

  async getObject<R extends ReturnType = "raw">(
    key: string,
    returnType: R = "raw" as R,
  ): Promise<ReturnTypeMap<R>> {
    const provider = this.providerOptions[
      this.defaultProvider
    ] as StorageInterface;

    return provider.getObject(key, returnType);
  }

  async putObject<T = Buffer<ArrayBufferLike>>(
    key: string,
    value: T,
    contentType?: string,
  ): Promise<void> {
    const provider = this.providerOptions[
      this.defaultProvider
    ] as StorageInterface;
    return provider.putObject(key, value, contentType);
  }

  async deleteObject(key: string): Promise<void> {
    const provider = this.providerOptions[
      this.defaultProvider
    ] as StorageInterface;
    return provider.deleteObject(key);
  }
}

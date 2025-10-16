class NativeCrypto {
  randomUUID(): string {
    return crypto.randomUUID();
  }
}

export const nativeCrypto = new NativeCrypto();

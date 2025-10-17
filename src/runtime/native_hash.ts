class NativeHash {
  private readonly ITERATIONS = 600_000;
  private readonly SALT_LENGTH = 16;
  private readonly KEY_LENGTH = 256;

  async hash(data: string): Promise<string> {
    if (!data) {
      throw new Error("Data to hash cannot be empty");
    }

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(data);

    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: this.ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      this.KEY_LENGTH,
    );

    const saltBase64 = this.encodeBase64(salt);
    const hashBase64 = this.encodeBase64(new Uint8Array(hashBuffer));

    return `${saltBase64}:${hashBase64}`;
  }

  async compare(hash: string, data: string): Promise<boolean> {
    if (!hash || !data) {
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(data);

      const parts = hash.split(":");
      if (parts.length !== 2) {
        throw new Error("Invalid hash format");
      }

      const [saltBase64, hashBase64] = parts;

      const salt = this.decodeBase64(saltBase64);
      const expectedHash = this.decodeBase64(hashBase64);

      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveBits"],
      );

      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt as BufferSource,
          iterations: this.ITERATIONS,
          hash: "SHA-256",
        },
        keyMaterial,
        this.KEY_LENGTH,
      );

      const actualHash = new Uint8Array(hashBuffer);

      if (actualHash.length !== expectedHash.length) {
        return false;
      }

      let mismatch = 0;
      for (let i = 0; i < actualHash.length; i++) {
        mismatch |= actualHash[i] ^ expectedHash[i];
      }

      return mismatch === 0;
    } catch (error) {
      return false;
    }
  }

  private encodeBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  private decodeBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const nativeHash = new NativeHash();

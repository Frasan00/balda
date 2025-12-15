import { describe, expect, it } from "vitest";
import { hash as nativeHash } from "../../src/runtime/native_hash.js";

describe("NativeHash", () => {
  describe("hash method", () => {
    it("should hash a simple string", async () => {
      const data = "test-password";
      const hash = await nativeHash.hash(data);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).toContain(":");
    });

    it("should hash a complex string with special characters", async () => {
      const data = "P@ssw0rd!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const hash = await nativeHash.hash(data);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).toContain(":");
    });

    it("should hash unicode strings", async () => {
      const data = "пароль123🔐";
      const hash = await nativeHash.hash(data);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).toContain(":");
    });

    it("should throw error for empty string", async () => {
      const data = "";

      await expect(nativeHash.hash(data)).rejects.toThrow(
        "Data to hash cannot be empty",
      );
    });

    it("should hash very long strings", async () => {
      const data = "a".repeat(10000);
      const hash = await nativeHash.hash(data);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).toContain(":");
    });

    it("should produce different hashes for the same input (due to random salt)", async () => {
      const data = "same-password";
      const hash1 = await nativeHash.hash(data);
      const hash2 = await nativeHash.hash(data);

      expect(hash1).not.toBe(hash2);
      expect(hash1).toContain(":");
      expect(hash2).toContain(":");
    });

    it("should produce different hashes for different inputs", async () => {
      const hash1 = await nativeHash.hash("password1");
      const hash2 = await nativeHash.hash("password2");

      expect(hash1).not.toBe(hash2);
    });

    it("should have consistent hash format (salt:hash)", async () => {
      const data = "test-password";
      const hash = await nativeHash.hash(data);
      const parts = hash.split(":");

      expect(parts).toHaveLength(2);
      expect(parts[0]).toBeDefined();
      expect(parts[1]).toBeDefined();
    });

    it("should handle whitespace in passwords", async () => {
      const data = "  password with spaces  ";
      const hash = await nativeHash.hash(data);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).toContain(":");
    });
  });

  describe("compare method", () => {
    it("should return true for matching password and hash", async () => {
      const password = "test-password";
      const hash = await nativeHash.hash(password);
      const isValid = await nativeHash.compare(hash, password);

      expect(isValid).toBe(true);
    });

    it("should return false for non-matching password and hash", async () => {
      const password = "test-password";
      const hash = await nativeHash.hash(password);
      const isValid = await nativeHash.compare(hash, "wrong-password");

      expect(isValid).toBe(false);
    });

    it("should return false for empty password", async () => {
      const password = "test-password";
      const hash = await nativeHash.hash(password);
      const isValid = await nativeHash.compare(hash, "");

      expect(isValid).toBe(false);
    });

    it("should return false for empty hash", async () => {
      const password = "test-password";
      const isValid = await nativeHash.compare("", password);

      expect(isValid).toBe(false);
    });

    it("should return false for both empty inputs", async () => {
      const isValid = await nativeHash.compare("", "");

      expect(isValid).toBe(false);
    });

    it("should return false for malformed hash format", async () => {
      const password = "test-password";
      const isValid = await nativeHash.compare("invalid-hash-format", password);

      expect(isValid).toBe(false);
    });

    it("should return false for hash with wrong number of parts", async () => {
      const password = "test-password";
      const isValid = await nativeHash.compare("part1:part2:part3", password);

      expect(isValid).toBe(false);
    });

    it("should handle case sensitivity correctly", async () => {
      const password = "Test-Password";
      const hash = await nativeHash.hash(password);
      const isValidLower = await nativeHash.compare(hash, "test-password");
      const isValidUpper = await nativeHash.compare(hash, "TEST-PASSWORD");
      const isValidExact = await nativeHash.compare(hash, "Test-Password");

      expect(isValidLower).toBe(false);
      expect(isValidUpper).toBe(false);
      expect(isValidExact).toBe(true);
    });

    it("should handle unicode characters correctly", async () => {
      const password = "пароль123🔐";
      const hash = await nativeHash.hash(password);
      const isValid = await nativeHash.compare(hash, password);
      const isInvalid = await nativeHash.compare(hash, "пароль123");

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it("should handle very long passwords", async () => {
      const password = "a".repeat(10000);
      const hash = await nativeHash.hash(password);
      const isValid = await nativeHash.compare(hash, password);
      const isInvalid = await nativeHash.compare(hash, "a".repeat(9999));

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it("should handle whitespace in passwords", async () => {
      const password = "  password with spaces  ";
      const hash = await nativeHash.hash(password);
      const isValid = await nativeHash.compare(hash, password);
      const isInvalid = await nativeHash.compare(hash, "password with spaces");

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe("security and consistency", () => {
    it("should produce consistent results across multiple calls", async () => {
      const password = "test-password";
      const hash = await nativeHash.hash(password);

      // Multiple comparisons should all return true
      const results = await Promise.all([
        nativeHash.compare(hash, password),
        nativeHash.compare(hash, password),
        nativeHash.compare(hash, password),
      ]);

      expect(results).toEqual([true, true, true]);
    });

    it("should handle concurrent hash operations", async () => {
      const passwords = ["pass1", "pass2", "pass3", "pass4", "pass5"];
      const hashes = await Promise.all(
        passwords.map((password) => nativeHash.hash(password)),
      );

      expect(hashes).toHaveLength(5);
      hashes.forEach((hash) => {
        expect(hash).toContain(":");
        expect(hash.split(":")).toHaveLength(2);
      });
    });

    it("should handle concurrent compare operations", async () => {
      const password = "test-password";
      const hash = await nativeHash.hash(password);

      const results = await Promise.all([
        nativeHash.compare(hash, password),
        nativeHash.compare(hash, "wrong-password"),
        nativeHash.compare(hash, password),
        nativeHash.compare(hash, "another-wrong-password"),
      ]);

      expect(results).toEqual([true, false, true, false]);
    });

    it("should have different salts for different hashes", async () => {
      const password = "same-password";
      const hash1 = await nativeHash.hash(password);
      const hash2 = await nativeHash.hash(password);

      const [salt1] = hash1.split(":");
      const [salt2] = hash2.split(":");

      expect(salt1).not.toBe(salt2);
    });

    it("should produce base64 encoded salt and hash", async () => {
      const password = "test-password";
      const hash = await nativeHash.hash(password);
      const [salt, hashPart] = hash.split(":");

      // Check if they are valid base64
      expect(() => atob(salt)).not.toThrow();
      expect(() => atob(hashPart)).not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should handle null/undefined inputs gracefully", async () => {
      // @ts-expect-error - Testing runtime behavior with invalid inputs
      const result1 = await nativeHash.compare(null, "password");
      // @ts-expect-error - Testing runtime behavior with invalid inputs
      const result2 = await nativeHash.compare("hash", null);
      // @ts-expect-error - Testing runtime behavior with invalid inputs
      const result3 = await nativeHash.compare(undefined, "password");
      // @ts-expect-error - Testing runtime behavior with invalid inputs
      const result4 = await nativeHash.compare("hash", undefined);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
      expect(result4).toBe(false);
    });

    it("should handle corrupted hash data", async () => {
      const password = "test-password";
      const corruptedHashes = [
        "invalid-base64:valid-hash",
        "valid-salt:invalid-base64",
        "not-base64:also-not-base64",
        "::",
        ":",
        "single-part",
      ];

      for (const corruptedHash of corruptedHashes) {
        const result = await nativeHash.compare(corruptedHash, password);
        expect(result).toBe(false);
      }
    });
  });
});

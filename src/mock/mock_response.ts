import { Response } from "../server/http/response.js";

export class MockResponse<T = any> {
  constructor(readonly response: Response) {}

  // base getters
  body(): T {
    const body = this.response.getBody();
    if (
      typeof body === "string" &&
      this.response.headers["Content-Type"]?.includes("json")
    ) {
      try {
        return JSON.parse(body) as T;
      } catch {
        // If parsing fails, return the raw body
        return body as T;
      }
    }
    return body as T;
  }

  statusCode(): number {
    return this.response.responseStatus;
  }

  headers(): Record<string, string> {
    return this.response.headers;
  }

  cookies(): Record<string, string> {
    const setCookieHeader =
      this.response.headers["set-cookie"] ||
      this.response.headers["Set-Cookie"];
    if (!setCookieHeader) {
      return {};
    }

    const cookies: Record<string, string> = {};
    const cookieStrings = setCookieHeader.split(", ");

    for (const cookieString of cookieStrings) {
      const [nameValue] = cookieString.split(";");
      if (nameValue) {
        const eqIndex = nameValue.indexOf("=");
        if (eqIndex > 0) {
          const name = decodeURIComponent(nameValue.slice(0, eqIndex).trim());
          const value = decodeURIComponent(nameValue.slice(eqIndex + 1).trim());
          cookies[name] = value;
        }
      }
    }

    return cookies;
  }

  // assertions
  assertStatus(status: number): this {
    if (this.response.responseStatus !== status) {
      throw new Error(
        `Expected status ${status}, but got ${this.response.responseStatus}`,
      );
    }
    return this;
  }

  assertHeader(header: string, value: string): this {
    if (this.response.headers[header] !== value) {
      throw new Error(
        `Expected header ${header} to be ${value}, but got ${this.response.headers[header]}`,
      );
    }
    return this;
  }

  assertHeaderExists(header: string): this {
    if (!(header in this.response.headers)) {
      throw new Error(
        `Expected header ${header} to exist, but it was not found`,
      );
    }
    return this;
  }

  assertHeaderNotExists(header: string): this {
    if (header in this.response.headers) {
      throw new Error(
        `Expected header ${header} to not exist, but it was found with value: ${this.response.headers[header]}`,
      );
    }
    return this;
  }

  assertCookie(name: string, value: string): this {
    const cookies = this.cookies();
    if (cookies[name] !== value) {
      throw new Error(
        `Expected cookie ${name} to be ${value}, but got ${cookies[name] ?? "undefined"}`,
      );
    }
    return this;
  }

  assertCookieExists(name: string): this {
    const cookies = this.cookies();
    if (!(name in cookies)) {
      throw new Error(`Expected cookie ${name} to exist, but it was not found`);
    }
    return this;
  }

  assertCookieNotExists(name: string): this {
    const cookies = this.cookies();
    if (name in cookies) {
      throw new Error(
        `Expected cookie ${name} to not exist, but it was found with value: ${cookies[name]}`,
      );
    }
    return this;
  }

  assertBodySubset(subset: Partial<T>): this {
    this.assertSubset(this.body(), subset, "body");
    return this;
  }

  assertBodyDeepEqual(expected: T): this {
    this.assertDeepEqual(this.body(), expected, "body");
    return this;
  }

  assertBodyNotSubset(subset: Partial<T>): this {
    this.assertNotSubset(this.body(), subset, "body");
    return this;
  }

  assertBodyNotDeepEqual(expected: T): this {
    this.assertNotDeepEqual(this.body(), expected, "body");
    return this;
  }

  assertCustom(assertion: (response: Response) => void): this {
    assertion(this.response);
    return this;
  }

  private assertSubset(target: any, subset: any, path: string): void {
    for (const key in subset) {
      const currentPath = path === "" ? key : `${path}.${key}`;
      const targetValue = target[key];
      const subsetValue = subset[key];

      if (!(key in target)) {
        throw new Error(
          `Expected ${path} to have key ${key}, but it was not found`,
        );
      }

      if (this.isObject(subsetValue) && this.isObject(targetValue)) {
        this.assertSubset(targetValue, subsetValue, currentPath);
      } else if (Array.isArray(subsetValue) && Array.isArray(targetValue)) {
        this.assertArraySubset(targetValue, subsetValue, currentPath);
      } else if (targetValue !== subsetValue) {
        throw new Error(
          `Expected ${currentPath} to be ${subsetValue}, but got ${targetValue}`,
        );
      }
    }
  }

  private assertDeepEqual(target: any, expected: any, path: string): void {
    if (this.isObject(target) && this.isObject(expected)) {
      const targetKeys = Object.keys(target);
      const expectedKeys = Object.keys(expected);

      if (targetKeys.length !== expectedKeys.length) {
        throw new Error(
          `Expected ${path} to have ${expectedKeys.length} keys, but got ${targetKeys.length}`,
        );
      }

      for (const key of expectedKeys) {
        const currentPath = path === "body" ? key : `${path}.${key}`;
        this.assertDeepEqual(target[key], expected[key], currentPath);
      }
    } else if (Array.isArray(target) && Array.isArray(expected)) {
      this.assertArrayDeepEqual(target, expected, path);
    } else if (target !== expected) {
      throw new Error(`Expected ${path} to be ${expected}, but got ${target}`);
    }
  }

  private assertNotSubset(target: any, subset: any, path: string): void {
    try {
      this.assertSubset(target, subset, path);
      throw new Error(
        `Expected ${path} to NOT contain the subset, but it does`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("Expected")) {
        // Original assertion failed, which means it's NOT a subset - this is what we want
        return;
      }
      throw error;
    }
  }

  private assertNotDeepEqual(target: any, expected: any, path: string): void {
    try {
      this.assertDeepEqual(target, expected, path);
      throw new Error(`Expected ${path} to NOT be deeply equal, but it is`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Expected")) {
        // Original assertion failed, which means they're NOT equal - this is what we want
        return;
      }
      throw error;
    }
  }

  private assertArraySubset(target: any[], subset: any[], path: string): void {
    if (subset.length > target.length) {
      throw new Error(
        `Expected ${path} to have at least ${subset.length} elements, but got ${target.length}`,
      );
    }

    for (let i = 0; i < subset.length; i++) {
      const currentPath = `${path}[${i}]`;
      const targetValue = target[i];
      const subsetValue = subset[i];

      if (this.isObject(subsetValue) && this.isObject(targetValue)) {
        this.assertSubset(targetValue, subsetValue, currentPath);
      } else if (Array.isArray(subsetValue) && Array.isArray(targetValue)) {
        this.assertArraySubset(targetValue, subsetValue, currentPath);
      } else if (targetValue !== subsetValue) {
        throw new Error(
          `Expected ${currentPath} to be ${subsetValue}, but got ${targetValue}`,
        );
      }
    }
  }

  private assertArrayDeepEqual(
    target: any[],
    expected: any[],
    path: string,
  ): void {
    if (target.length !== expected.length) {
      throw new Error(
        `Expected ${path} to have ${expected.length} elements, but got ${target.length}`,
      );
    }

    for (let i = 0; i < expected.length; i++) {
      const currentPath = `${path}[${i}]`;
      this.assertDeepEqual(target[i], expected[i], currentPath);
    }
  }

  private isObject(value: any): boolean {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}

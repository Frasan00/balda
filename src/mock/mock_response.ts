import { Response } from "../server/http/response.js";

export class MockResponse<T = any> {
  constructor(private readonly response: Response) {}

  // base getters
  body(): T {
    return this.response.getBody();
  }

  statusCode(): number {
    return this.response.responseStatus;
  }

  headers(): Record<string, string> {
    return this.response.headers;
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

  // TODO: body assertions

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

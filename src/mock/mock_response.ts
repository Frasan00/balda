import { Response } from "../server/http/response";

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
        `Expected status ${status}, but got ${this.response.responseStatus}`
      );
    }
    return this;
  }

  assertHeader(header: string, value: string): this {
    if (this.response.headers[header] !== value) {
      throw new Error(
        `Expected header ${header} to be ${value}, but got ${this.response.headers[header]}`
      );
    }
    return this;
  }

  assertHeaderExists(header: string): this {
    if (!(header in this.response.headers)) {
      throw new Error(
        `Expected header ${header} to exist, but it was not found`
      );
    }
    return this;
  }

  assertHeaderNotExists(header: string): this {
    if (header in this.response.headers) {
      throw new Error(
        `Expected header ${header} to not exist, but it was found with value: ${this.response.headers[header]}`
      );
    }
    return this;
  }

  // TODO: body assertions

  assertCustom(assertion: (response: Response) => void): this {
    assertion(this.response);
    return this;
  }
}

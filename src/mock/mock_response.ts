import { Response } from "../server/http/response";

export class MockResponse {
  constructor(private readonly response: Response) {}

  // base getters
  body() {
    return this.response.getBody();
  }

  statusCode() {
    return this.response.responseStatus;
  }

  headers() {
    return this.response.headers;
  }

  // assertions
  assertStatus(status: number) {
    if (this.response.responseStatus !== status) {
      throw new Error(
        `Expected status ${status}, but got ${this.response.responseStatus}`
      );
    }
    return this;
  }

  assertHeader(header: string, value: string) {
    if (this.response.headers[header] !== value) {
      throw new Error(
        `Expected header ${header} to be ${value}, but got ${this.response.headers[header]}`
      );
    }
    return this;
  }

  assertHeaderExists(header: string) {
    if (!(header in this.response.headers)) {
      throw new Error(
        `Expected header ${header} to exist, but it was not found`
      );
    }
    return this;
  }

  assertHeaderNotExists(header: string) {
    if (header in this.response.headers) {
      throw new Error(
        `Expected header ${header} to not exist, but it was found with value: ${this.response.headers[header]}`
      );
    }
    return this;
  }

  // TODO: body assertions

  assertCustom(assertion: (response: Response) => void) {
    assertion(this.response);
    return this;
  }
}

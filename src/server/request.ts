import { NativeRequest } from "../runtime/native_request";

export class Request extends NativeRequest {
  params: Record<string, string> = {};

  get query(): Record<string, string> {
    console.log('asdasdasdas', JSON.stringify(this.url));
    const url = new URL(this.url);
    const queryParams: Record<string, string> = {};

    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }

    return queryParams;
  }
}

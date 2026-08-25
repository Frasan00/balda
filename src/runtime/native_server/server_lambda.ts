// `import type` only - "aws-lambda" has no runtime module behind it (@types/aws-lambda is a
// pure type-declarations package), so a plain `import` here would try to `require("aws-lambda")`
// at runtime and crash. `import type` is fully erased by the compiler/bundler, so this stays a
// devDependency with zero runtime footprint in the published package.
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import type { Server } from "../../server/server.js";

/**
 * The API Gateway **HTTP API v2** (`version: "2.0"`) request event - the same payload shape
 * Lambda Function URLs send, so this one type covers both.
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
export type LambdaProxyEventV2 = APIGatewayProxyEventV2;

/** The always-structured shape `handle()` returns - never the plain-string shorthand. */
export type LambdaProxyResultV2 = APIGatewayProxyStructuredResultV2;

/**
 * Content types safe to hand back as plain text. Anything else - unrecognized types, and any
 * response carrying a Content-Encoding (gzip/deflate/br, e.g. from the compression plugin) -
 * is base64-encoded instead, since API Gateway/Function URLs need the exact bytes and a JSON
 * string body can't represent those reliably.
 */
function isTextResponse(headers: globalThis.Headers): boolean {
  if (headers.has("content-encoding")) {
    return false;
  }

  const mimeType = (headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  return (
    mimeType.startsWith("text/") ||
    mimeType.endsWith("+json") ||
    mimeType.endsWith("+xml") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/xml" ||
    mimeType === "application/x-www-form-urlencoded"
  );
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  // Lambda's Node runtimes always have `Buffer`; this is a fallback for other callers.
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function eventToRequest(event: LambdaProxyEventV2): globalThis.Request {
  const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `https://${event.requestContext.domainName}${event.rawPath}${query}`;
  const method = event.requestContext.http.method.toUpperCase();

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }
  if (event.cookies?.length) {
    headers.set("cookie", event.cookies.join("; "));
  }

  // GET/HEAD requests cannot carry a body per the Fetch API - `new Request()` throws if given one.
  const canHaveBody = method !== "GET" && method !== "HEAD";
  const body =
    canHaveBody && event.body !== undefined
      ? ((event.isBase64Encoded
          ? fromBase64(event.body)
          : event.body) as BodyInit)
      : undefined;

  return new Request(url, { method, headers, body });
}

async function responseToResult(
  response: globalThis.Response,
): Promise<LambdaProxyResultV2> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      headers[key] = value;
    }
  });
  const cookies = response.headers.getSetCookie();

  const asText = isTextResponse(response.headers);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const body = asText ? new TextDecoder().decode(bytes) : toBase64(bytes);

  return {
    statusCode: response.status,
    headers,
    ...(cookies.length ? { cookies } : {}),
    body,
    isBase64Encoded: !asText,
  };
}

/**
 * Bridges an AWS Lambda **API Gateway HTTP API v2** event to `server.fetch()`. Also covers
 * Lambda Function URLs, which use the same `version: "2.0"` payload shape.
 *
 * @example
 * ```typescript
 * import { handle } from "balda";
 *
 * export const handler = handle(server);
 * ```
 *
 * `LambdaProxyEventV2`/`LambdaProxyResultV2` alias `@types/aws-lambda`'s
 * `APIGatewayProxyEventV2`/`APIGatewayProxyStructuredResultV2` - an optional peer dependency.
 * `handle()` itself needs nothing installed (the reference is `import type`-only and fully
 * erased), but a consumer whose own tsconfig has `skipLibCheck: false` should add
 * `@types/aws-lambda` as a devDependency so balda's bundled `.d.ts` resolves cleanly.
 *
 * Not supported here - add if/when actually needed:
 * - API Gateway REST API v1 (`multiValueHeaders`), ALB, and VPC Lattice event shapes
 * - Lambda@Edge (CloudFront's header-array format)
 * - Response streaming (`awslambda.streamifyResponse`)
 *
 * Balda also runs on Lambda today with zero framework code via the
 * [AWS Lambda Web Adapter](https://github.com/awslambdapowertools/aws-lambda-web-adapter)
 * layer, since `server.listen()` is a real HTTP server - this adapter exists for a smaller
 * cold start / no extra layer, at the cost of only supporting the v2 event shape above.
 */
export const handle = (
  server: Server,
): ((event: LambdaProxyEventV2) => Promise<LambdaProxyResultV2>) => {
  return async (event: LambdaProxyEventV2): Promise<LambdaProxyResultV2> => {
    const request = eventToRequest(event);
    const response = await server.fetch(request);
    return responseToResult(response);
  };
};

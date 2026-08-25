import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  InvokeCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import * as esbuild from "esbuild";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runtime } from "../../src/runtime/runtime.js";
import { zipSingleFile } from "./fixtures/zip.js";

/**
 * End-to-end proof that `handle()` (the AWS Lambda adapter) works inside a *real* Lambda
 * runtime, not just against fixture events (see `lambda.test.ts` for that). Bundles
 * `fixtures/lambda_app.ts` - a real balda `Server` wired through `handle()` - into a Lambda
 * deployment zip with esbuild, deploys it to Floci's Docker-backed `nodejs22.x` executor, and
 * invokes it over the real Lambda API.
 *
 * Runs against LocalStack's replacement, Floci (see docker-compose.worktree.yml's `localstack`
 * service) - requires Docker (Floci's Lambda executor spawns containers via the mounted
 * `/var/run/docker.sock`), so this only runs inside the worktree compose stack, same as
 * `storage/s3.test.ts`.
 *
 * Node-only: the bundled function always runs inside Floci's own `nodejs22.x` container
 * regardless of which runtime launched vitest, so running this identical deployment 3x under
 * node/bun/deno adds no extra coverage - only extra Floci round-trips.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ENTRY = path.join(here, "fixtures/lambda_app.ts");
const ENDPOINT = process.env.AWS_ENDPOINT_URL || "http://localhost:4566";

const describeNode = runtime.type === "node" ? describe : describe.skip;

describeNode("AWS Lambda adapter on Floci (real Lambda runtime)", () => {
  const client = new LambdaClient({
    region: "us-east-1",
    endpoint: ENDPOINT,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  const functionName = `balda-fetch-handler-test-${Date.now()}`;

  beforeAll(async () => {
    // Bundle a real balda Server + handle() into one self-contained CJS file - `packages:
    // "bundle"` inlines node_modules too, since the Lambda container has none of its own.
    // `inject`/`define` shim `import.meta.url` for the CJS output (esbuild otherwise emits an
    // empty `{}` for `import.meta`, which crashes `src/package.ts`'s ESM/CJS detection) - the
    // real published build doesn't need this since tsup shims it automatically.
    const result = await esbuild.build({
      entryPoints: [FIXTURE_ENTRY],
      bundle: true,
      platform: "node",
      format: "cjs",
      packages: "bundle",
      inject: [path.join(here, "fixtures/import-meta-url-shim.js")],
      define: { "import.meta.url": "import_meta_url" },
      write: false,
      outfile: "index.js",
    });
    const code = Buffer.from(result.outputFiles[0].text, "utf8");
    const zip = zipSingleFile("index.js", code);

    await client.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: "nodejs22.x",
        Role: "arn:aws:iam::000000000000:role/lambda-role",
        Handler: "index.handler",
        Code: { ZipFile: zip },
        Timeout: 15,
      }),
    );
  }, 60_000);

  afterAll(async () => {
    await client
      .send(new DeleteFunctionCommand({ FunctionName: functionName }))
      .catch(() => {});
  }, 30_000);

  async function invoke(event: Record<string, unknown>) {
    const res = await client.send(
      new InvokeCommand({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify(event)),
      }),
    );
    expect(res.FunctionError).toBeUndefined();
    return JSON.parse(Buffer.from(res.Payload!).toString("utf8"));
  }

  it("resolves a path param through a real nodejs22.x Lambda invocation", async () => {
    const result = await invoke({
      version: "2.0",
      rawPath: "/hello/floci",
      rawQueryString: "",
      headers: {},
      requestContext: {
        domainName: "test.lambda-url.us-east-1.on.aws",
        http: { method: "GET" },
      },
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ message: "Hello, floci!" });
  }, 60_000);

  it("parses a JSON POST body through a real nodejs22.x Lambda invocation", async () => {
    const result = await invoke({
      version: "2.0",
      rawPath: "/echo",
      rawQueryString: "",
      headers: { "content-type": "application/json" },
      requestContext: {
        domainName: "test.lambda-url.us-east-1.on.aws",
        http: { method: "POST" },
      },
      body: JSON.stringify({ hello: "floci" }),
      isBase64Encoded: false,
    });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ hello: "floci" });
  }, 60_000);
});

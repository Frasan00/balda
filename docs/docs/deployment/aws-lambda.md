---
title: AWS Lambda
description: Run balda on AWS Lambda — the native handle() adapter for API Gateway HTTP API v2 / Function URLs, or the zero-code AWS Lambda Web Adapter for anything else.
keywords: [balda, aws lambda, api gateway, function url, lambda web adapter]
sidebar_position: 3
---

# AWS Lambda

Balda has two ways onto Lambda, and they trade off against each other.

## The native adapter

`handle()` bridges an **API Gateway HTTP API v2** (`version: "2.0"`) event to `server.fetch()`.
Lambda **Function URLs** use this exact same payload shape, so `handle()` covers both:

```typescript
import { Server, handle } from "balda";

const server = new Server({ swagger: false });

export const handler = handle(server);
```

No extra layer, smaller cold start — but it only understands the v2 event shape. Not
supported, deliberately out of scope until someone needs it:

- API Gateway **REST API v1** events (`multiValueHeaders`)
- Application Load Balancer (ALB) target events
- VPC Lattice events
- Lambda@Edge (CloudFront's header-array response format)
- Response streaming (`awslambda.streamifyResponse`)

`LambdaProxyEventV2`/`LambdaProxyResultV2` alias `@types/aws-lambda`'s own
`APIGatewayProxyEventV2`/`APIGatewayProxyStructuredResultV2` types (an optional peer
dependency, listed in `peerDependenciesOptional` — `handle()` itself needs nothing installed,
this only matters if your own tsconfig has `skipLibCheck: false`):

```bash
npm install -D @types/aws-lambda
```

## The Lambda Web Adapter alternative

Balda ships a real HTTP server, so it also runs on Lambda **today, with zero framework
code**, via the [AWS Lambda Web
Adapter](https://github.com/awslambdapowertools/aws-lambda-web-adapter) layer — it proxies any
event shape (REST API v1, ALB, Function URLs, and more) to a plain `server.listen()` process.
This is the framework-agnostic path: it works because balda is a real server, not because of
anything Lambda-specific in balda itself.

Reach for the Web Adapter when you need an event shape `handle()` doesn't cover, or want one
deployment artifact that also runs unmodified on a container host. Reach for `handle()` when
you're specifically on API Gateway v2 / Function URLs and want the smaller cold start.

## How the bridge works

`handle()` reconstructs a Web `Request` from the event (`rawPath` + `rawQueryString`, headers,
`cookies[]` merged into a `Cookie` header, the body decoded from base64 when
`isBase64Encoded`), runs it through `server.fetch()`, and converts the resulting `Response`
back to the v2 result shape:

- `Set-Cookie` response headers go into `result.cookies`, not `result.headers` — API Gateway
  v2 keeps them separate.
- The body comes back as plain text when the response's content type is textual (`text/*`,
  `application/json`, `+json`, `+xml`, etc.) and no `Content-Encoding` is set; otherwise it's
  base64-encoded. A gzip'd response (e.g. from the [compression
  plugin](../plugins/compression.md)) is always base64-encoded, since API Gateway needs the
  exact bytes.

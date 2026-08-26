---
title: Deployment Overview
description: How balda's Node/Bun/Deno support maps to hosting platforms, and where server.fetch() unlocks the rest.
keywords: [balda, deployment, fetch, vercel, netlify, deno deploy, supabase, cloudflare, lambda]
sidebar_position: 1
---

# Deployment Overview

There are only four real JavaScript server runtimes: **Node.js**, **Bun**, **Deno**, and
**Cloudflare Workers' `workerd`**. Balda supports the first three. Everything else you'll see
called a "supported platform" by other frameworks — Vercel, Netlify, Deno Deploy, Supabase Edge
Functions, AWS Lambda, a Service Worker — is a *deployment target* that runs one of those
runtimes underneath, or hands you a Web-standard `Request` and expects a `Response` back.

Balda exposes two ways to run:

- **`server.listen()`** — starts a real HTTP server on Node, Bun, or Deno. This is what you
  reach for on any container host: Cloud Run, Fly, Railway, Render, AWS App Runner, a plain VM.
  No code changes needed for any of these — they just run your Dockerfile.
- **`server.fetch(request)`** — a Web-standard `fetch(request) => Promise<response>` handler,
  for platforms that hand you a `Request` directly instead of letting you bind a port. See
  [The fetch() handler](./fetch-handler.md).

## Support table

| Target | Runtime underneath | What you need |
|---|---|---|
| Cloud Run, Fly, Railway, Render, App Runner, a VM | Node, Bun, or Deno | Nothing — `server.listen()` already works |
| Deno Deploy, Supabase Edge Functions | Deno | `Deno.serve(server.fetch)` |
| Vercel Functions (Node runtime), Netlify Functions | Node | `export default server.fetch` |
| A Service Worker | — | `evt.respondWith(server.fetch(evt.request))` |
| AWS Lambda (API Gateway HTTP API v2 / Function URLs) | Node | `handle(server)` — see [AWS Lambda](./aws-lambda.md) |
| AWS Lambda (any event shape) | Node | The [AWS Lambda Web Adapter](./aws-lambda.md#the-lambda-web-adapter-alternative) layer, zero code |

## Cloudflare Workers is not supported

This is the one real runtime balda doesn't run on, and it isn't a small gap: `ajv` and
`fast-json-stringify` — balda's default validation and serialization path — both compile
schemas via `new Function`, which `workerd` refuses to run (`EvalError: Code generation from
strings disallowed for this context`). Supporting Workers means compiling schemas ahead of
time instead of at route-registration time, which is a change to the validation layer itself,
not a deployment adapter. It isn't planned for now.

## Caveat: controller autoloading needs a real filesystem

Balda's `controllerPatterns` option imports controllers by globbing the filesystem at
bootstrap. Deno Deploy and Supabase Edge Functions don't give you one. On those targets,
register your routes and controllers explicitly instead of relying on autoloading.

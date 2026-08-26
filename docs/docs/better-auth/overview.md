---
title: Better Auth
description: Mount a better-auth instance on a Balda server with a single call. Fully optional, no runtime dependency.
keywords: [balda, better-auth, authentication, auth, session, oauth]
sidebar_position: 1
---

# Better Auth

Balda ships a one-line adapter for [better-auth](https://www.better-auth.com), a framework-agnostic authentication and authorization library. The adapter is **completely optional** — Balda never imports `better-auth` at runtime, only its types, so the dependency costs nothing until you install it yourself.

> **Peer dependency** — install `better-auth` in your own project:
>
> ```bash
> npm install better-auth
> # or
> yarn add better-auth
> pnpm add better-auth
> bun add better-auth
> ```

## Quick Start

Define your `auth` instance the same way you would in any other framework:

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  baseURL: "https://your-app.com",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true },
});
```

Then mount it on your server with `mountBetterAuth`:

```typescript
import { Server, mountBetterAuth } from "balda";
import { auth } from "./lib/auth.js";

mountBetterAuth(auth);

const server = new Server();
server.listen(3000);
```

That's it — every route better-auth defines (`/api/auth/sign-in/email`, `/api/auth/callback/:provider`, `/api/auth/get-session`, …) is now live.

## Custom base path

By default the mount path is resolved as:

1. an explicit `basePath` option, if given
2. `auth.options.basePath`
3. `/api/auth`

```typescript
mountBetterAuth(auth, { basePath: "/auth" });
```

## Reading the session in a handler

Use `auth.api.getSession()` directly — no extra plugin needed:

```typescript
import { auth } from "./lib/auth.js";

router.get("/me", async (req, res) => {
  const session = await auth.api.getSession({ headers: req.rawHeaders });
  if (!session) return res.unauthorized();
  return res.json(session.user);
});
```

For typed `req.user` across many routes, wrap it in a `defineMiddleware`:

```typescript
import { defineMiddleware } from "balda";
import { auth } from "./lib/auth.js";

export const requireAuth = defineMiddleware<{
  user: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];
}>(async (req, res, next) => {
  const session = await auth.api.getSession({ headers: req.rawHeaders });
  if (!session) return res.unauthorized();
  req.user = session.user;
  return next();
});

router.get("/me", { middlewares: [requireAuth] }, (req, res) => {
  res.json(req.user); // typed
});
```

:::note Fresh reads after a mutation
`get-session` can return a cached response for a short window after you
change the user (`update-user`, `change-email`, …) or revoke a session. If
you read the session right after mutating it, pass `disableCookieCache`:

```typescript
await auth.api.getSession({
  headers: req.rawHeaders,
  query: { disableCookieCache: true },
});
```
:::

## Behind a proxy

The adapter rebuilds the request URL from `X-Forwarded-Host` / `X-Forwarded-Proto` (falling back to `Host`) instead of Balda's bind address, since better-auth derives its origin from the request when `baseURL` isn't set.

:::warning Set `baseURL` explicitly in production
The adapter trusts `X-Forwarded-Host`/`X-Forwarded-Proto` unconditionally, with no allowlist — the same default better-auth itself uses. That's only safe **behind a reverse proxy that strips client-supplied `X-Forwarded-*` headers before setting its own.** If your app is reachable directly, or your proxy doesn't strip these, a forged header can influence the origin used for CSRF checks and for generated URLs (password reset links, OAuth callbacks). Hardcoding `baseURL` removes the dependency on these headers for URL generation regardless of proxy setup.
:::

## Works with `bodyParser`

No ordering constraint — mount `mountBetterAuth` and register the `bodyParser` plugin in any order:

```typescript
const server = new Server({
  plugins: { bodyParser: { json: {} } },
});
mountBetterAuth(auth);
```

If `bodyParser` already parsed the request, the adapter re-serializes `req.body` for better-auth instead of re-reading the (already consumed) request stream.

## Independent from Balda's own session plugin

Better-auth manages its own cookies and session store end to end. Balda's built-in [`cookie`](../plugins/cookie) plugin and `session` plugin are unrelated — don't expect a better-auth session to show up in `req.session`.

## API Reference

### `mountBetterAuth(auth, options?)`

Mounts every better-auth route on the Balda router.

- `auth` — a configured better-auth instance (`betterAuth({...})`)
- `options.basePath` — overrides the mount path

### `betterAuthHandler(auth)`

Returns a single `ServerRouteHandler` that forwards one request to `auth.handler()`. Use this instead of `mountBetterAuth` if you want to register the routes yourself:

```typescript
import { betterAuthHandler } from "balda";

router.get("/api/auth/*", betterAuthHandler(auth));
router.post("/api/auth/*", betterAuthHandler(auth));
```

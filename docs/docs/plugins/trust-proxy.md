---
title: Trust Proxy Plugin
description: Safely resolve the client IP behind reverse proxies using an explicit trusted-proxy allowlist and X-Forwarded-For.
keywords: [balda, trust proxy, x-forwarded-for, reverse proxy, client ip, security]
sidebar_position: 10
---

# Trust Proxy Plugin

Resolves the real client IP when Balda runs behind a reverse proxy (nginx, Traefik, AWS ALB, Cloudflare, etc.). Without this plugin, `req.ip` is always the **direct socket peer** — which is correct and safe when the app is exposed directly to the internet.

The plugin only reads `X-Forwarded-For` (or a custom header) when the **immediate peer** matches your `trustedProxies` allowlist. That prevents clients from forging a client IP by sending their own `X-Forwarded-For` header.

## Quick Start

Single reverse proxy in front of the app:

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    trustProxy: {
      trustedProxies: ["10.0.0.1"],
    },
    rateLimiter: {
      keyOptions: { type: "ip", limit: 100 },
      storageOptions: { type: "memory", windowMs: 60_000 },
    },
  },
});
```

Register `trustProxy` **before** plugins that read `req.ip` (for example `rateLimiter` with `type: "ip"`).

## Default behavior (no plugin)

| Scenario | `req.ip` |
|----------|----------|
| No `trustProxy` middleware | Socket peer IP (safe default) |
| Untrusted peer sends `X-Forwarded-For` | Still socket peer IP — header ignored |
| Trusted peer + valid `X-Forwarded-For` | Client IP from the chain (see `hops`) |

Balda does **not** read `X-Forwarded-For` automatically. You must opt in with `trustProxy()` and an explicit allowlist.

## Configuration

### trustedProxies (required)

Allowlist of proxy IPs that may append to the forwarded chain. Each entry is either:

- An **exact IPv4 address** (e.g. `"127.0.0.1"`, `"10.0.0.1"`)
- An **IPv4 CIDR** (e.g. `"10.0.0.0/8"`, `"172.16.0.0/12"`)

The **direct TCP peer** must match this list before any forwarded header is used.

```typescript
trustProxy: {
  trustedProxies: [
    "127.0.0.1",
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
  ],
}
```

:::warning Production allowlists
List only **your** proxy/load-balancer addresses. A broad range such as `0.0.0.0/0` or an entire RFC1918 block on an internet-facing host lets any peer forge `req.ip`.
:::

### hops

Number of trusted proxy hops at the **right** end of the `X-Forwarded-For` list. The client IP is taken at `length - hops`.

| `hops` | XFF chain | Resolved client IP |
|--------|-----------|-------------------|
| `1` (default) | `client, proxy1` | `client` (last entry) |
| `2` | `client, proxy1, proxy2` | `client` (second from right) |

```typescript
// App → corporate proxy → public load balancer → Balda
trustProxy: {
  trustedProxies: ["10.0.0.0/8"],
  hops: 2,
}
```

If the chain is shorter than `hops`, the leftmost entry is used.

### header

Header to read the IP chain from. Defaults to `x-forwarded-for`.

```typescript
trustProxy: {
  trustedProxies: ["10.0.0.1"],
  header: "x-real-ip", // only if your proxy sets a single-IP header as a chain substitute
}
```

Most deployments should keep the default `x-forwarded-for` unless your proxy documents a different chain header.

## Route-level usage

Apply only on routes that need the resolved IP, or run globally via `plugins`:

```typescript
import { trustProxy } from "balda";

@controller("/api")
export class ApiController {
  @get("/client-ip", {
    middleware: [
      trustProxy({
        trustedProxies: ["10.0.0.1"],
      }),
    ],
  })
  async clientIp(req: Request, res: Response) {
    res.json({ ip: req.ip });
  }
}
```

## Middleware order

```mermaid
flowchart LR
  Request[Incoming request] --> TrustProxy[trustProxy]
  TrustProxy --> RateLimiter[rateLimiter type ip]
  RateLimiter --> Handler[Route handler]
```

1. `trustProxy` — may rewrite `req.ip` from `X-Forwarded-For`
2. `rateLimiter` / logging / ACLs that use `req.ip`
3. Route handlers

Example with explicit `server.use()`:

```typescript
const server = new Server();

server.use(
  trustProxy({ trustedProxies: ["10.0.0.1"] }),
);
server.use(
  rateLimiter(
    { type: "ip", limit: 200 },
    { type: "memory", windowMs: 60_000 },
  ),
);
```

## Common deployment patterns

### nginx (one hop)

```typescript
trustProxy: {
  trustedProxies: ["127.0.0.1"], // or the nginx container/host IP
  hops: 1,
}
```

nginx should set:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### Docker / private network

```typescript
trustProxy: {
  trustedProxies: ["172.16.0.0/12"],
  hops: 1,
}
```

### Kubernetes ingress (one hop)

```typescript
trustProxy: {
  trustedProxies: ["10.0.0.0/8"], // ingress controller pod CIDR — tighten to your cluster
  hops: 1,
}
```

## What this plugin does not do

- **No `X-Forwarded-Proto` / `Host` handling** — use TLS termination at the proxy and configure cookies/CORS explicitly.
- **No IPv6 CIDR matching** — CIDR checks are IPv4 only; use exact IPv6 addresses in `trustedProxies` if needed.
- **No validation of IP format** in the header — malformed values may be assigned to `req.ip`; rely on a correct proxy chain.
- **Raw headers remain visible** — `req.rawHeaders.get("x-forwarded-for")` still returns the full header; only `req.ip` is gated.

For Express compatibility, the adapter may read `x-forwarded-proto` separately without the same peer check — prefer Balda’s `trustProxy` for IP decisions.

## Security considerations

### Safe patterns

- Minimal `trustedProxies` list (exact proxy IPs or the smallest CIDR that covers them).
- Correct `hops` for your topology (count only **trusted** proxies).
- Register `trustProxy` early in the middleware stack.
- Keep rate limiting and audit logs on the resolved `req.ip` only after trust is established.

### Avoid

- `trustedProxies: ["0.0.0.0/0"]` on a publicly reachable process.
- Trusting `X-Forwarded-For` without verifying the peer (Balda blocks this by default).
- Placing `rateLimiter` with `type: "ip"` **before** `trustProxy` behind a load balancer (every client shares the proxy IP).

## Complete example

```typescript
import { Server } from "balda";

const server = new Server({
  port: 3000,
  plugins: {
    trustProxy: {
      trustedProxies: (process.env.TRUSTED_PROXY_CIDRS ?? "127.0.0.1")
        .split(",")
        .map((s) => s.trim()),
      hops: Number(process.env.TRUST_PROXY_HOPS ?? "1"),
    },
    log: {},
    rateLimiter: {
      keyOptions: {
        type: "ip",
        limit: 100,
      },
      storageOptions: {
        type: "memory",
        windowMs: 60_000,
      },
    },
  },
});

@controller("/api")
export class ApiController {
  @get("/whoami")
  async whoami(req: Request, res: Response) {
    res.json({ ip: req.ip });
  }
}
```

## API reference

```typescript
trustProxy(options: {
  trustedProxies: string[];  // required — exact IPv4 or IPv4 CIDR
  hops?: number;             // default 1
  header?: string;           // default "x-forwarded-for"
})
```

Throws at startup if `trustedProxies` is missing or empty.

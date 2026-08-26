---
title: Helmet Plugin
description: Secure your app with HTTP security headers. Protect against XSS, clickjacking, and other web vulnerabilities.
keywords: [balda, helmet, security, headers, xss, csp, clickjacking]
sidebar_position: 6
---

# Helmet Plugin

Sets various HTTP security headers to help protect your application from well-known web vulnerabilities.

## Quick Start

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    helmet: {}, // Enable with defaults
  },
});
```

## Default Configuration

```typescript
helmet: {
  dnsPrefetchControl: true,
  frameguard: { action: "SAMEORIGIN" },
  hsts: { maxAge: 15552000, includeSubDomains: true, preload: false },
  contentTypeOptions: true,
  ieNoOpen: true,
  xssFilter: true,
  referrerPolicy: "no-referrer",
  crossOriginResourcePolicy: "same-origin",
  crossOriginOpenerPolicy: "same-origin",
  crossOriginEmbedderPolicy: "require-corp",
  contentSecurityPolicy: false  // Disabled by default
}
```

## Configuration

### Content Security Policy (CSP)

```typescript
helmet: {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.example.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}
```

### HTTP Strict Transport Security (HSTS)

```typescript
helmet: {
  hsts: {
    maxAge: 31536000,        // 1 year in seconds
    includeSubDomains: true, // Apply to subdomains
    preload: true            // Include in browser preload lists
  }
}
```

### Frame Options

```typescript
helmet: {
  frameguard: {
    action: "DENY";
  } // Prevent embedding in frames
}

// Or
helmet: {
  frameguard: {
    action: "SAMEORIGIN";
  } // Allow same-origin framing
}
```

### Referrer Policy

```typescript
helmet: {
  referrerPolicy: "no-referrer"; // Don't send referrer
}

// Or
helmet: {
  referrerPolicy: "strict-origin-when-cross-origin";
}
```

## Complete Example

```typescript
const server = new Server({
  plugins: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: "DENY" },
      contentTypeOptions: true,
      xssFilter: true,
      referrerPolicy: "no-referrer",
    },
  },
});
```

## Security Headers Explained

| Header                       | Purpose                           | Default            |
| ---------------------------- | --------------------------------- | ------------------ |
| Content-Security-Policy      | Prevent XSS and injection attacks | Disabled           |
| Strict-Transport-Security    | Force HTTPS                       | `max-age=15552000` |
| X-Frame-Options              | Prevent clickjacking              | `SAMEORIGIN`       |
| X-Content-Type-Options       | Prevent MIME sniffing             | `nosniff`          |
| X-XSS-Protection             | Enable XSS filter                 | Enabled            |
| Referrer-Policy              | Control referrer information      | `no-referrer`      |
| Cross-Origin-Resource-Policy | Control resource sharing          | `same-origin`      |

## Environment-Based Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  plugins: {
    helmet: isProduction
      ? {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
            },
          },
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
        }
      : {},
  },
});
```

## Disabling Helmet

```typescript
const server = new Server({
  plugins: {
    helmet: false,
  },
});
```

## Common Configurations

### API Server

```typescript
helmet: {
  contentSecurityPolicy: false,  // Not needed for API-only
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: "DENY" },
  referrerPolicy: "no-referrer"
}
```

### Web Application with CDN

```typescript
helmet: {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://cdn.myapp.com"],
      scriptSrc: ["'self'", "https://cdn.myapp.com"],
      imgSrc: ["'self'", "https://cdn.myapp.com", "data:"],
      fontSrc: ["'self'", "https://cdn.myapp.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}
```

### Development Mode

```typescript
helmet: {
  contentSecurityPolicy: false,  // Disable CSP in development
  hsts: false                    // Disable HSTS in development
}
```

## Best Practices

1. **Enable HSTS in production** - Force HTTPS connections
2. **Configure CSP carefully** - Test thoroughly before deploying
3. **Use frameguard** - Prevent clickjacking attacks
4. **Set referrer policy** - Control information leakage
5. **Keep headers up to date** - Security best practices evolve

## Troubleshooting

### CSP Blocking Resources

If Content-Security-Policy blocks legitimate resources:

```typescript
helmet: {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://trusted-cdn.com"],  // Add trusted sources
      styleSrc: ["'self'", "'unsafe-inline'"]  // Allow inline styles if needed
    }
  }
}
```

### Development vs Production

```typescript
const isDev = process.env.NODE_ENV !== 'production';

helmet: {
  contentSecurityPolicy: isDev ? false : { /* production CSP */ },
  hsts: isDev ? false : { maxAge: 31536000 }
}
```

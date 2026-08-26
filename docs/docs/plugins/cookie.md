---
title: Cookie Plugin
description: Parse and manage HTTP cookies. Set, get, and clear cookies with signed cookie support for security.
keywords: [balda, cookie, session, signed cookies, http]
sidebar_position: 5
---

# Cookie Plugin

Provides comprehensive cookie parsing and management. Automatically parses incoming cookies and provides convenient methods for setting and clearing cookies on responses.

## Quick Start

```typescript
import { Server } from "balda";

const server = new Server({
  plugins: {
    cookie: {
      secret: "your-secret-key",
    },
  },
});
```

## Configuration

```typescript
cookie: {
  secret: 'your-secret-key',     // Required for signed cookies
  parse: true,                   // Enable cookie parsing (default: true)
  sign: false,                   // Enable cookie signing (default: false)
  defaults: {
    path: '/',                   // Cookie path (default: '/')
    httpOnly: true,              // HttpOnly flag (default: true)
    secure: false,               // Secure flag (default: false)
    sameSite: 'Lax'             // SameSite attribute (default: 'Lax')
  }
}
```

### Production Configuration

```typescript
cookie: {
  secret: process.env.COOKIE_SECRET,
  sign: true,
  defaults: {
    httpOnly: true,
    secure: true,            // HTTPS only
    sameSite: 'Strict',
    domain: '.myapp.com'
  }
}
```

## Usage

### Setting Cookies

```typescript
@controller("/auth")
export class AuthController {
  @post("/login")
  async login(req: Request, res: Response) {
    const user = await validateUser(req.body.username, req.body.password);

    if (user) {
      // Set cookie
      res.cookie("sessionId", user.sessionId, {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: true,
      });

      res.json({ message: "Login successful" });
    }
  }

  @post("/logout")
  async logout(req: Request, res: Response) {
    // Clear cookie
    res.clearCookie("sessionId");
    res.json({ message: "Logout successful" });
  }
}
```

### Reading Cookies

```typescript
@get('/profile')
async getProfile(req: Request, res: Response) {
  const sessionId = req.cookies.sessionId;
  const theme = req.cookies.theme || 'light';

  if (!sessionId) {
    return res.unauthorized({ error: 'No session found' });
  }

  const user = await getUserBySession(sessionId);
  res.json({ user, theme });
}
```

### Setting Multiple Cookies

```typescript
@post('/preferences')
async setPreferences(req: Request, res: Response) {
  const { theme, language, timezone } = req.body;  // Automatically parsed when using body parser middleware with json setting

  res
    .cookie('theme', theme, { maxAge: 365 * 24 * 60 * 60 * 1000 })
    .cookie('language', language, { maxAge: 365 * 24 * 60 * 60 * 1000 })
    .cookie('timezone', timezone, { maxAge: 365 * 24 * 60 * 60 * 1000 })
    .json({ message: 'Preferences updated' });
}
```

## Cookie Options

### maxAge

Cookie expiration in milliseconds:

```typescript
res.cookie("name", "value", {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});
```

### httpOnly

Prevent JavaScript access (recommended for security):

```typescript
res.cookie("sessionId", value, {
  httpOnly: true, // Cannot be accessed via JavaScript
});
```

### secure

Only send over HTTPS:

```typescript
res.cookie("sessionId", value, {
  secure: true, // HTTPS only
});
```

### sameSite

CSRF protection:

```typescript
res.cookie("name", value, {
  sameSite: "Strict", // or 'Lax' or 'None'
});
```

### domain

Cookie domain:

```typescript
res.cookie("name", value, {
  domain: ".myapp.com", // Works for all subdomains
});
```

### path

Cookie path:

```typescript
res.cookie("name", value, {
  path: "/api", // Only sent to /api routes
});
```

## Signed Cookies

Enable signing for tamper-proof cookies:

```typescript
// Configuration
cookie: {
  secret: 'your-secret-key',
  sign: true
}

// Set signed cookie
res.cookie('userId', user.id, {
  signed: true,
  httpOnly: true
});

// Read signed cookie
const userId = req.signedCookies.userId;
```

## Security Best Practices

### Session Cookies

```typescript
res.cookie("sessionId", sessionId, {
  httpOnly: true, // Prevent XSS
  secure: true, // HTTPS only
  sameSite: "Strict", // Prevent CSRF
  maxAge: 24 * 60 * 60 * 1000,
});
```

### Authentication Tokens

```typescript
res.cookie("authToken", token, {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  signed: true, // Prevent tampering
});
```

### User Preferences

```typescript
res.cookie("theme", "dark", {
  httpOnly: false, // Allow JavaScript access
  secure: true,
  sameSite: "Lax",
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
});
```

## Environment-Based Configuration

```typescript
const isProduction = process.env.NODE_ENV === "production";

const server = new Server({
  plugins: {
    cookie: {
      secret: process.env.COOKIE_SECRET,
      sign: isProduction,
      defaults: {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "Strict" : "Lax",
      },
    },
  },
});
```

## Common Patterns

### Session Management

```typescript
cookie: {
  secret: process.env.SESSION_SECRET,
  sign: true,
  defaults: {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}
```

### Remember Me

```typescript
res.cookie("rememberMe", token, {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

### Analytics Tracking

```typescript
res.cookie("tracking", trackingId, {
  httpOnly: false,
  secure: true,
  sameSite: "Lax",
  maxAge: 365 * 24 * 60 * 60 * 1000,
});
```

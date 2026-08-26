---
title: Hashing
description: Secure password hashing with PBKDF2-SHA256. Hash and verify passwords with built-in cryptographic functions.
keywords: [balda, hashing, password, pbkdf2, sha256, encryption]
sidebar_position: 6
---

# Hashing

Balda provides built-in secure password hashing using PBKDF2 with SHA-256.

## Overview

- **Algorithm:** PBKDF2 with SHA-256
- **Default iterations:** 600,000
- **Default salt length:** 16 bytes
- **Default key length:** 256 bits
- **Format:** `salt:hash` (base64-encoded)

## Basic Usage

```typescript
import { hash } from "balda";

// Hash a password
const hashedPassword = await hash.hash("user-password-123");

// Verify password
const isValid = await hash.compare(hashedPassword, "user-password-123");
console.log(isValid); // true
```

## Authentication Example

```typescript
import { controller, post, hash } from "balda";

@controller("/auth")
export class AuthController {
  @post("/register")
  async register(req: Request, res: Response) {
    const { email, password } = req.body;

    const hashedPassword = await hash.hash(password);
    await saveUser(email, hashedPassword);

    res.created({ message: "User registered" });
  }

  @post("/login")
  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    const user = await findUser(email);
    const isValid = await hash.compare(user.passwordHash, password);

    if (!isValid) {
      return res.unauthorized({ error: "Invalid credentials" });
    }

    res.json({ token: generateToken(user) });
  }
}
```

## Configuration

Customize hashing parameters to balance security and performance:

```typescript
import { hash } from "balda";

hash.configure({
  iterations: 1_000_000, // Default: 600,000 (min: 1)
  saltLength: 32, // Default: 16 bytes (min: 8)
  keyLength: 512, // Default: 256 bits (min: 128)
});
```

### Options

| Option       | Default  | Min | Description                                     |
| ------------ | -------- | --- | ----------------------------------------------- |
| `iterations` | 600,000  | 1   | PBKDF2 iterations. Higher = more secure, slower |
| `saltLength` | 16 bytes | 8   | Random salt length. Longer = more secure        |
| `keyLength`  | 256 bits | 128 | Derived key length                              |

### Configuration Examples

```typescript
import { hash } from "balda";

// Development (faster hashing)
if (process.env.NODE_ENV === "development") {
  hash.configure({ iterations: 10_000 });
}

// High security
hash.configure({
  iterations: 1_500_000,
  saltLength: 32,
  keyLength: 512,
});
```

:::caution
Configure hash settings **before** hashing passwords. Changing configuration makes existing hashes incompatible.
:::

## Security Best Practices

```typescript
import { hash } from "balda";

// ✅ Always hash passwords before storing
const passwordHash = await hash.hash(password);

// ✅ Use strong password requirements
const minLength = 12;
const requireUppercase = true;
const requireNumbers = true;
const requireSpecialChars = true;

// ✅ Implement rate limiting on auth endpoints
import { rateLimiter } from "balda";
server.use(
  "/auth/login",
  rateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
  }),
);

// ✅ Use HTTPS in production
// ✅ Log security events (failed logins, etc.)
```

## API Reference

### `hash.configure(options): void`

Configure hash settings.

```typescript
import { hash } from 'balda';

hash.configure({
  iterations?: number,   // Default: 600,000, min: 1
  saltLength?: number,   // Default: 16 bytes, min: 8
  keyLength?: number     // Default: 256 bits, min: 128
});
```

**Throws:** `Error` if values are below minimum thresholds.

### `hash.hash(data: string): Promise<string>`

Hash a string using PBKDF2 with SHA-256.

```typescript
const hashed = await hash.hash("my-password");
// Returns: "base64-salt:base64-hash"
```

**Throws:** `Error` if data is empty.

### `hash.compare(hash: string, data: string): Promise<boolean>`

Verify a string against a hash.

```typescript
const isValid = await hash.compare(hashed, "my-password");
// Returns: true or false
```

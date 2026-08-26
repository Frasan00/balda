---
title: key-generate
description: Generate RSA public/private key pairs for JWT signing, encryption, and API authentication.
keywords: [balda, key generate, rsa, encryption, jwt, authentication]
sidebar_position: 6
---

# key-generate

Generate RSA public/private key pairs for application encryption.

```bash
npx balda key-generate
npx balda key-generate --type async
```

## Flags

- `-t, --type <type>`: Key type - `sync` or `async` (default: `sync`)

## What it does

Generates secure 2048-bit RSA key pairs and automatically saves them to your `.env` file:

### Sync Keys (default)

- `APP_PUBLIC_KEY`: Public key in PEM format
- `APP_PRIVATE_KEY`: Private key in PEM format

### Async Keys

- `APP_PUBLIC_KEY_ASYNC`: Public key in PEM format
- `APP_PRIVATE_KEY_ASYNC`: Private key in PEM format

Keys are saved in PEM format wrapped in quotes for proper `.env` compatibility.

## Use Cases

- JWT token signing and verification
- Secure data encryption/decryption
- API authentication
- Digital signatures

## Examples

```bash
# Generate sync keys
npx balda key-generate

# Generate async keys
npx balda key-generate --type async
```

:::tip
Keep your private keys secure and never commit them to version control. Add `.env` to your `.gitignore` file.
:::

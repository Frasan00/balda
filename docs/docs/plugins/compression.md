---
title: Compression Plugin
description: Automatically compress response bodies with gzip. Reduce bandwidth and improve load times for production APIs.
keywords: [balda, compression, gzip, bandwidth, performance]
sidebar_position: 4
---

# Compression

Automatically compress response bodies using gzip to reduce bandwidth and improve load times.

## Quick Start

```typescript
import { Server } from "balda";

const app = new Balda({
  plugins: {
    compression: {
      threshold: 1024,
      level: 6,
    },
  },
});
```

## Configuration

### Basic Options

```typescript
compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (0-9)
});
```

### Custom Content Type Filtering

```typescript
compression({
  threshold: 2048,
  level: 9,
  filter: [/text\/.+/, /application\/json/, /application\/javascript/],
});
```

## Options

| Option      | Type       | Default           | Description                                           |
| ----------- | ---------- | ----------------- | ----------------------------------------------------- |
| `threshold` | `number`   | `1024`            | Minimum response size in bytes to trigger compression |
| `level`     | `number`   | `6`               | Compression level (0 = no compression, 9 = maximum)   |
| `filter`    | `RegExp[]` | Common text types | Content types to compress (regex patterns)            |

## Default Compressible Types

By default, compression applies to:

- All text types (`text/*`)
- JSON (`application/json`, `application/*+json`)
- JavaScript (`application/javascript`)
- XML (`application/xml`, `application/*+xml`)

## How It Works

1. Checks if client supports gzip via `Accept-Encoding` header
2. Verifies response size exceeds threshold
3. Matches content type against filter patterns
4. Compresses response body using gzip
5. Sets `Content-Encoding: gzip` header

## Performance Tips

- **Lower threshold** for faster networks (512 bytes)
- **Higher threshold** for slower networks (2048+ bytes)
- **Level 6** balances speed and compression ratio
- **Level 1-3** for CPU-constrained environments
- **Level 9** for maximum bandwidth savings

## Example: Production Config

```typescript
const app = new Balda({
  plugins: {
    compression: compression({
      threshold: 1024,
      level: 6,
      filter: [
        /text\/.+/,
        /application\/json/,
        /application\/javascript/,
        /image\/svg\+xml/,
      ],
    }),
  },
});
```

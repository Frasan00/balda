---
title: Method Override Plugin
description: Enable PUT, PATCH, DELETE verbs for clients that only support GET and POST. Useful for HTML forms and legacy browsers.
keywords: [balda, method override, http verbs, put, patch, delete]
sidebar_position: 5
---

# Method Override

Enable HTTP verb support (PUT, PATCH, DELETE) for clients that only support GET and POST (like HTML forms or older browsers).

## Quick Start

```typescript
import { Server } from "balda";

const app = new Server({
  plugins: {
    methodOverride: {
      methods: ["POST"],
      header: "X-HTTP-Method-Override",
    },
  },
});
```

## Configuration

### Basic Usage

```typescript
methodOverride({
  methods: ["POST"], // Methods that can be overridden
  header: "X-HTTP-Method-Override", // Header to read override from
});
```

### Custom Configuration

```typescript
methodOverride({
  methods: ["POST", "GET"],
  header: "X-HTTP-Method",
});
```

## Options

| Option    | Type       | Default                  | Description                                  |
| --------- | ---------- | ------------------------ | -------------------------------------------- |
| `methods` | `string[]` | `['POST']`               | HTTP methods that can be overridden          |
| `header`  | `string`   | `X-HTTP-Method-Override` | Header name to read the override method from |

## How It Works

1. Checks if request method is in allowed methods (default: POST)
2. Reads override method from header
3. Validates override method (GET, POST, PUT, PATCH, DELETE)
4. Updates `req.method` with the override value

## Use Cases

### HTML Forms

HTML forms only support GET and POST. Use this to enable PUT/DELETE:

```html
<form method="POST" action="/users/123">
  <input type="hidden" name="_method" value="DELETE" />
  <button type="submit">Delete User</button>
</form>
```

```typescript
// With body parser that extracts _method field
app.post("/users/:id", (req, res) => {
  if (req.method === "DELETE") {
    // Handle deletion
  }
});
```

### Client Requests

```typescript
// Client-side
fetch("/api/users/123", {
  method: "POST",
  headers: {
    "X-HTTP-Method-Override": "DELETE",
    "Content-Type": "application/json",
  },
});
```

```typescript
// Server-side - receives as DELETE
app.delete("/api/users/:id", (req, res) => {
  // Handles the request
});
```

## Example: Complete Setup

```typescript
import { Server, methodOverride, json } from "balda";

const app = new Server({
  plugins: {
    json: {
      sizeLimit: "10mb",
    },
    methodOverride: {
      methods: ["POST"],
      header: "X-HTTP-Method-Override",
    },
  },
});

// This route will handle both actual DELETE and overridden POST->DELETE
app.delete("/users/:id", (req, res) => {
  res.json({ message: "User deleted" });
});
```

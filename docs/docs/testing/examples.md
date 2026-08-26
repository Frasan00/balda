---
title: Testing Examples
description: Practical examples for testing Balda apps with server.inject() and MockServer. Controller tests, middleware, authentication, and file uploads.
keywords: [balda, testing, examples, vitest, jest, mock, inject]
sidebar_position: 3
---

# Testing Examples

This guide provides practical examples of testing with Balda's `server.inject()` and MockServer, covering common scenarios and patterns.

## Using `server.inject()`

### Quick API Testing

```typescript
import { describe, it, expect } from "vitest";
import { Server } from "balda";

const server = new Server({
  port: 3000,
  controllerPatterns: ["src/controllers/**/*.ts"],
});

describe("User API with inject", () => {
  it("GET /users returns user list", async () => {
    const res = await server.inject.get("/users");
    expect(res.statusCode()).toBe(200);
    expect(Array.isArray(res.body())).toBe(true);
  });

  it("POST /users creates a user", async () => {
    const res = await server.inject.post("/users", {
      body: { name: "John", email: "john@example.com", age: 30 },
    });
    expect(res.statusCode()).toBe(201);
    expect(res.assertBodySubset({ name: "John" }));
  });

  it("DELETE /users/:id removes a user", async () => {
    const res = await server.inject.delete("/users/1");
    expect(res.statusCode()).toBe(204);
  });
});
```

## Using MockServer

### Simple GET Request

```typescript
import { describe, it, expect } from "vitest";
import { mockServer } from "test/server/instance";

describe("Basic API Tests", () => {
  it("GET /users returns user list", async () => {
    const res = await mockServer.get("/users");

    expect(res.statusCode()).toBe(200);
    expect(Array.isArray(res.body())).toBe(true);
    expect(res.body().length).toBeGreaterThan(0);
  });
});
```

### GET with Query Parameters

```typescript
it("GET /users with pagination", async () => {
  const res = await mockServer.get("/users", {
    query: { page: "1", limit: "5" },
  });

  expect(res.statusCode()).toBe(200);
  expect(res.body().length).toBeLessThanOrEqual(5);
});
```

### GET with Headers

```typescript
it("GET /protected with authorization", async () => {
  const res = await mockServer.get("/protected", {
    headers: { Authorization: "Bearer token123" },
  });

  expect(res.statusCode()).toBe(200);
});
```

## POST Request Testing

### JSON Body

```typescript
it("POST /users creates new user", async () => {
  const newUser = {
    name: "John Doe",
    email: "john@example.com",
    age: 30,
  };

  const res = await mockServer.post("/users", { body: newUser });

  expect(res.statusCode()).toBe(201);
  expect(res.assertBodyDeepEqual(newUser));
});
```

### Form Data (URL Encoded)

```typescript
it("POST /users with form data", async () => {
  const res = await mockServer.post("/users", {
    urlencoded: {
      name: "Jane Doe",
      email: "jane@example.com",
      age: "25",
    },
  });

  expect(res.statusCode()).toBe(201);
  expect(res.assertBodySubset({ name: "Jane Doe" }));
});
```

### File Upload

```typescript
it("POST /upload handles file upload", async () => {
  const formData = new FormData();
  const fileContent = new Uint8Array([1, 2, 3, 4, 5]);
  formData.append("file", new Blob([fileContent]), "test.txt");

  const res = await mockServer.post("/upload", { formData });

  expect(res.statusCode()).toBe(200);
  expect(res.body()).toEqual({
    originalName: "test.txt",
    filename: "file",
    size: 5,
    mimetype: "application/octet-stream",
  });
});
```

## Error Handling Examples

### 404 Not Found

```typescript
it("GET /users/999 returns 404", async () => {
  const res = await mockServer.get("/users/999");

  expect(res.statusCode()).toBe(404);
  expect(res.assertBodyDeepEqual({ error: "User not found" }));
});
```

### 409 Conflict

```typescript
it("POST /users returns 409 for existing user", async () => {
  const existingUser = {
    id: 1,
    name: "John Doe",
    email: "john.doe@example.com",
    age: 20,
  };

  const res = await mockServer.post("/users", { body: existingUser });

  expect(res.statusCode()).toBe(409);
  expect(res.assertBodyDeepEqual({ error: "User already exists" }));
});
```

### Server Error

```typescript
it("GET /users with shouldFail=true returns 500", async () => {
  const res = await mockServer.get("/users", {
    query: { shouldFail: "true" },
  });

  expect(res.statusCode()).toBe(500);
});
```

## CRUD Operations Testing

### Complete CRUD Test Suite

```typescript
describe("User CRUD Operations", () => {
  it("creates a new user", async () => {
    const newUser = {
      id: 3,
      name: "New User",
      email: "new@example.com",
      age: 30,
    };

    const res = await mockServer.post("/users", { body: newUser });

    expect(res.statusCode()).toBe(201);
    expect(res.assertBodyDeepEqual(newUser));
  });

  it("reads a specific user", async () => {
    const res = await mockServer.get("/users/1");

    expect(res.statusCode()).toBe(200);
    expect(res.assertBodySubset({ id: 1 }));
  });

  it("updates a user", async () => {
    const res = await mockServer.patch("/users/1", {
      body: { name: "Updated Name" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.assertBodySubset({ id: 1, name: "Updated Name" }));
  });

  it("deletes a user", async () => {
    const res = await mockServer.delete("/users/1");

    expect(res.statusCode()).toBe(204);
  });
});
```

## Authentication Testing

### Protected Routes

```typescript
describe("Authentication", () => {
  it("accesses protected route with valid token", async () => {
    const res = await mockServer.get("/protected", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(res.statusCode()).toBe(200);
  });

  it("rejects access without token", async () => {
    const res = await mockServer.get("/protected");

    expect(res.statusCode()).toBe(401);
  });

  it("rejects access with invalid token", async () => {
    const res = await mockServer.get("/protected", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(res.statusCode()).toBe(401);
  });
});
```

## Cookie Testing

### Setting and Reading Cookies

```typescript
describe("Cookie Handling", () => {
  it("sets session cookie on login", async () => {
    const res = await mockServer.post("/login", {
      body: { username: "user", password: "pass" },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.headers()["set-cookie"]).toContain("sessionId");
  });

  it("uses existing session cookie", async () => {
    const res = await mockServer.get("/profile", {
      cookies: { sessionId: "valid-session" },
    });

    expect(res.statusCode()).toBe(200);
  });
});
```

## Advanced Testing Patterns

### Testing with Custom Headers

```typescript
it("handles custom headers", async () => {
  const res = await mockServer.get("/api/data", {
    headers: {
      "X-API-Key": "secret-key",
      "X-Client-Version": "1.0.0",
      "Content-Type": "application/json",
    },
  });

  expect(res.statusCode()).toBe(200);
});
```

### Testing with IP Address

```typescript
it("handles IP-based logic", async () => {
  const res = await mockServer.get("/location", {
    ip: "192.168.1.100",
  });

  expect(res.statusCode()).toBe(200);
  expect(res.body()).toHaveProperty("ip", "192.168.1.100");
});
```

### Testing Query Parameters

```typescript
it("handles complex query parameters", async () => {
  const res = await mockServer.get("/search", {
    query: {
      q: "search term",
      category: "technology",
      sort: "date",
      order: "desc",
      page: "1",
      limit: "20",
    },
  });

  expect(res.statusCode()).toBe(200);
  expect(res.body()).toHaveProperty("results");
});
```

## Testing Middleware

### Rate Limiting

```typescript
describe("Rate Limiting", () => {
  it("allows requests within limit", async () => {
    const res = await mockServer.get("/api/limited");
    expect(res.statusCode()).toBe(200);
  });

  it("blocks requests over limit", async () => {
    // Simulate multiple requests
    for (let i = 0; i < 10; i++) {
      await mockServer.get("/api/limited");
    }

    const res = await mockServer.get("/api/limited");
    expect(res.statusCode()).toBe(429);
  });
});
```

### CORS Testing

```typescript
describe("CORS", () => {
  it("handles preflight OPTIONS request", async () => {
    const res = await mockServer.request("OPTIONS", "/api/data", {
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(res.statusCode()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
  });
});
```

## Performance Testing

### Load Testing with MockServer

```typescript
describe("Performance", () => {
  it("handles multiple concurrent requests", async () => {
    const promises = Array.from({ length: 100 }, () =>
      mockServer.get("/api/data"),
    );

    const results = await Promise.all(promises);

    results.forEach((res) => {
      expect(res.statusCode()).toBe(200);
    });
  });
});
```

## Best Practices

### Test Organization

```typescript
describe("User API", () => {
  describe("GET /users", () => {
    it("returns all users", async () => {
      // Test implementation
    });

    it("supports pagination", async () => {
      // Test implementation
    });
  });

  describe("POST /users", () => {
    it("creates new user", async () => {
      // Test implementation
    });

    it("validates required fields", async () => {
      // Test implementation
    });
  });
});
```

### Type Safety

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

describe("Type-safe testing", () => {
  it("returns properly typed user data", async () => {
    const res = await mockServer.get<User[]>("/users");
    const users = res.body() as User[];

    expect(users[0]).toHaveProperty("id");
    expect(users[0]).toHaveProperty("name");
    expect(users[0]).toHaveProperty("email");
  });
});
```

These examples demonstrate the flexibility and power of `server.inject()` and MockServer for comprehensive API testing in Balda applications.

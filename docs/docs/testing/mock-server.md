---
title: MockServer & Inject Testing
description: Test HTTP endpoints without starting a real server. Use server.inject() or MockServer to execute middleware chains with mocked request/response objects.
keywords: [balda, mockserver, inject, testing, mock, http, endpoints]
sidebar_position: 2
---

# MockServer & Inject Testing

Balda provides two ways to test HTTP endpoints without starting a real server: **`server.inject()`** for direct request injection and **`MockServer`** for a dedicated testing instance.

Both approaches:

- Execute the complete middleware chain
- Run route handlers with mocked request/response objects
- Provide realistic testing without network overhead
- Support all HTTP methods and content types
- Lazily bootstrap the server on the first request

## `server.inject()` — Direct Injection

The `inject` property on the Server instance allows you to send requests directly into the routing pipeline. It's the quickest way to test routes.

### Basic Usage

```typescript
import { describe, it, expect } from "vitest";
import { Server } from "balda";

const server = new Server({ port: 3000 });

describe("API Tests", () => {
  it("GET /users returns all users", async () => {
    const res = await server.inject.get("/users");
    expect(res.statusCode()).toBe(200);
    expect(Array.isArray(res.body())).toBe(true);
  });

  it("POST /users creates a user", async () => {
    const res = await server.inject.post("/users", {
      body: { name: "John", email: "john@example.com" },
    });
    expect(res.statusCode()).toBe(201);
  });
});
```

### Generic Inject

Use the generic form when you need to specify the HTTP method dynamically:

```typescript
const res = await server.inject("GET", "/users");
const res = await server.inject("POST", "/users", { body: { name: "John" } });
```

### HTTP Method Shortcuts

```typescript
// GET (no body)
const res = await server.inject.get("/users");

// POST
const res = await server.inject.post("/users", { body: { name: "John" } });

// PUT
const res = await server.inject.put("/users/1", { body: { name: "Jane" } });

// PATCH
const res = await server.inject.patch("/users/1", { body: { name: "Jane" } });

// DELETE (no body)
const res = await server.inject.delete("/users/1");
```

### Type-Safe Inject

All inject methods support TypeScript generics for full type safety:

```typescript
type User = { id: number; name: string; email: string };
type CreateUserInput = { name: string; email: string };

// Typed response
const res = await server.inject.get<User[]>("/users");
res.body()[0].name; // ✅ typed

// Typed body and response
const res = await server.inject.post<User, CreateUserInput>("/users", {
  body: { name: "John", email: "john@example.com" },
});
res.body().id; // ✅ typed
```

## `MockServer` — Dedicated Test Instance

MockServer is a standalone testing class that wraps the same injection logic. Use it when you want a separate test instance or need to pass custom controller patterns.

### Basic Usage

```typescript
import { describe, it, expect } from "vitest";
import { Server } from "balda";

const server = new Server({ port: 3000 });

// getMockServer() is synchronous
const mockServer = server.getMockServer();

describe("API Tests", () => {
  it("GET /users returns all users", async () => {
    const res = await mockServer.get("/users");
    expect(res.statusCode()).toBe(200);
    expect(Array.isArray(res.body())).toBe(true);
  });
});
```

### Custom Controller Patterns

```typescript
// Use custom controller patterns for test-specific controllers
const mockServer = server.getMockServer({
  controllerPatterns: ["test/controllers/**/*.ts"],
});
```

## HTTP Methods

Both `inject` and `MockServer` provide methods for all HTTP verbs:

### GET Requests

```typescript
// Simple GET request
const res = await mockServer.get("/users");

// GET with query parameters
const res = await mockServer.get("/users", {
  query: { page: "1", limit: "10" },
});

// GET with headers
const res = await mockServer.get("/users", {
  headers: { Authorization: "Bearer token123" },
});
```

### POST Requests

```typescript
// POST with JSON body
const res = await mockServer.post("/users", {
  body: { name: "John", email: "john@example.com" },
});

// POST with form data
const res = await mockServer.post("/users", {
  urlencoded: { name: "John", email: "john@example.com" },
});

// POST with file upload
const formData = new FormData();
formData.append("file", new Blob(["content"]), "test.txt");
const res = await mockServer.post("/upload", { formData });
```

### Other HTTP Methods

```typescript
// PUT request
const res = await mockServer.put("/users/1", {
  body: { name: "Updated Name" },
});

// PATCH request
const res = await mockServer.patch("/users/1", {
  body: { name: "Patched Name" },
});

// DELETE request
const res = await mockServer.delete("/users/1");
```

## Request Options

Both `inject` and `MockServer` support comprehensive request configuration:

```typescript
interface MockServerOptions {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  cookies?: Record<string, string>;
  ip?: string;
  body?: any;
  formData?: FormData;
  urlencoded?: Record<string, string>;
}
```

### Headers

```typescript
const res = await mockServer.get("/protected", {
  headers: {
    Authorization: "Bearer token123",
    "Content-Type": "application/json",
  },
});
```

### Query Parameters

```typescript
const res = await mockServer.get("/search", {
  query: {
    q: "search term",
    page: "1",
    limit: "20",
  },
});
```

### Cookies

```typescript
const res = await mockServer.get("/profile", {
  cookies: {
    sessionId: "abc123",
    userId: "456",
  },
});
```

### IP Address

```typescript
const res = await mockServer.get("/location", {
  ip: "192.168.1.1",
});
```

## Response Assertions

MockResponse provides powerful assertion methods:

### Status Code Assertions

```typescript
const res = await mockServer.get("/users");
expect(res.statusCode()).toBe(200);
expect(res.assertStatus(200)); // Alternative syntax
```

### Body Assertions

```typescript
// Exact body match
expect(res.assertBodyDeepEqual({ id: 1, name: "John" }));

// Partial body match
expect(res.assertBodySubset({ name: "John" }));

// Get body content
const body = res.body();
expect(body.name).toBe("John");
```

### Complete Example

```typescript
describe("User API", () => {
  it("creates a new user", async () => {
    const newUser = {
      name: "Jane Doe",
      email: "jane@example.com",
      age: 25,
    };

    const res = await mockServer.post("/users", { body: newUser });

    expect(res.assertStatus(201));
    expect(res.assertBodyDeepEqual(newUser));
  });

  it("returns 404 for non-existent user", async () => {
    const res = await mockServer.get("/users/999");

    expect(res.assertStatus(404));
    expect(res.assertBodyDeepEqual({ error: "User not found" }));
  });
});
```

## File Upload Testing

MockServer supports file upload testing with FormData:

```typescript
describe("File Upload", () => {
  it("uploads a file successfully", async () => {
    const formData = new FormData();
    const fileContent = new Uint8Array([1, 2, 3, 4, 5]);
    formData.append("file", new Blob([fileContent]), "test.txt");

    const res = await mockServer.post("/upload", { formData });

    expect(res.assertStatus(200));
    expect(res.body()).toEqual({
      originalName: "test.txt",
      filename: "file",
      size: 5,
      mimetype: "application/octet-stream",
    });
  });
});
```

## Error Handling

MockServer properly handles and reports errors:

```typescript
describe("Error Handling", () => {
  it("handles server errors gracefully", async () => {
    const res = await mockServer.get("/users", {
      query: { shouldFail: "true" },
    });

    expect(res.assertStatus(500));
    expect(res.body()).toHaveProperty("error");
  });
});
```

## Best Practices

### 1. Test Isolation

```typescript
describe("User Management", () => {
  // Each test should be independent
  it("creates user", async () => {
    // Test implementation
  });

  it("updates user", async () => {
    // Test implementation - doesn't depend on previous test
  });
});
```

### 2. Descriptive Test Names

```typescript
// Good
it("POST /users returns 409 when user already exists", async () => {
  // Test implementation
});

// Avoid
it("test user creation", async () => {
  // Test implementation
});
```

### 3. Use TypeScript for Type Safety

See the [Type-Safe Testing](#type-safe-testing) section below for comprehensive type safety examples.

### 4. Test Edge Cases

```typescript
describe("User Validation", () => {
  it("rejects invalid email format", async () => {
    const res = await mockServer.post("/users", {
      body: { name: "John", email: "invalid-email" },
    });

    expect(res.assertStatus(400));
  });

  it("requires all mandatory fields", async () => {
    const res = await mockServer.post("/users", {
      body: { name: "John" }, // Missing email
    });

    expect(res.assertStatus(400));
  });
});
```

## Type-Safe Testing

MockServer supports full TypeScript type safety through explicit generic type parameters. This ensures compile-time checking of request bodies, query parameters, and response types.

### Basic Type-Safe Requests

```typescript
// Define your types
type User = {
  id: number;
  name: string;
  email: string;
  age: number;
};

type CreateUserInput = {
  name: string;
  email: string;
  age: number;
};

type UserQuery = {
  limit?: string;
  offset?: string;
};

// Type-safe GET request
const res = await mockServer.get<User[]>("/users");
expect(res.body[0].name).toBe("John"); // Fully typed!

// Type-safe POST request with body type
const createRes = await mockServer.post<User, CreateUserInput>("/users", {
  body: {
    name: "Jane Doe",
    email: "jane@example.com",
    age: 25,
  },
});
expect(createRes.body.id).toBeDefined(); // Type-safe response

// Type-safe GET with query parameters
const queryRes = await mockServer.get<User[], UserQuery>("/users", {
  query: { limit: "10" },
});
```

### HTTP Method Type Signatures

```typescript
// GET - no body allowed
mockServer.get<TResponse, TQuery>(path, options?)

// POST - with body
mockServer.post<TResponse, TBody, TQuery>(path, options?)

// PUT - with body
mockServer.put<TResponse, TBody, TQuery>(path, options?)

// PATCH - with body
mockServer.patch<TResponse, TBody, TQuery>(path, options?)

// DELETE - no body allowed
mockServer.delete<TResponse, TQuery>(path, options?)
```

### Type-Safe Error Handling

```typescript
type ErrorResponse = {
  error: string;
  code?: string;
};

type UserResponse = User | ErrorResponse;

const res = await mockServer.get<UserResponse>("/users/999");

if (res.statusCode === 404) {
  // TypeScript knows this is ErrorResponse
  expect((res.body as ErrorResponse).error).toBe("User not found");
}
```

### Organizing Test Types

For better maintainability, organize types in separate files:

```typescript
// types/api.types.ts
export type User = {
  id: number;
  name: string;
  email: string;
  age: number;
};

export type CreateUserInput = Omit<User, "id">;
export type UpdateUserInput = Partial<CreateUserInput>;

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
};

// tests/user.test.ts
import { User, CreateUserInput, PaginatedResponse } from "../types/api.types";

const res = await mockServer.get<PaginatedResponse<User>>("/users");
expect(res.body.data).toHaveLength(10);
expect(res.body.total).toBeGreaterThan(0);
```

### Complete Type-Safe Test Example

```typescript
import { describe, it, expect } from "vitest";
import { User, CreateUserInput, UpdateUserInput } from "../types/api.types";

describe("User API - Type Safe", () => {
  it("creates user with type safety", async () => {
    const newUser: CreateUserInput = {
      name: "John Doe",
      email: "john@example.com",
      age: 30,
    };

    const res = await mockServer.post<User, CreateUserInput>("/users", {
      body: newUser,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe(newUser.name); // Fully typed!
    expect(res.body).toHaveProperty("id"); // Response includes id
  });

  it("updates user with partial data", async () => {
    const updates: UpdateUserInput = {
      name: "Jane Doe", // Only updating name
    };

    const res = await mockServer.patch<User, UpdateUserInput>("/users/1", {
      body: updates,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe(updates.name);
  });

  it("handles typed error responses", async () => {
    type ErrorResponse = { error: string };

    const res = await mockServer.get<ErrorResponse>("/users/999");

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("User not found"); // Typed error!
  });
});
```

### Benefits of Type-Safe Testing

✅ **Compile-Time Safety** - Catch mistakes before running tests
✅ **IDE Autocomplete** - Full IntelliSense support for request/response
✅ **Self-Documenting** - Types serve as inline API documentation
✅ **Refactor Confidence** - TypeScript catches breaking changes
✅ **Better Testing Experience** - Less time debugging, more time coding

## Advanced Features

### Custom Request Configuration

```typescript
// Using inject
const res = await server.inject("GET", "/api/data", {
  headers: {
    "X-Custom-Header": "value",
    Authorization: "Bearer token",
  },
  query: { filter: "active" },
  cookies: { sessionId: "abc123" },
  ip: "192.168.1.100",
});

// Using MockServer
const res = await mockServer.request("GET", "/api/data", {
  headers: {
    "X-Custom-Header": "value",
    Authorization: "Bearer token",
  },
  query: { filter: "active" },
  cookies: { sessionId: "abc123" },
  ip: "192.168.1.100",
});
```

### Testing Middleware

Both `inject` and `MockServer` execute the complete middleware chain, allowing you to test:

- Authentication middleware
- Rate limiting
- CORS handling
- Request logging
- Custom business logic middleware

This comprehensive testing approach ensures your entire request pipeline works correctly in isolation.

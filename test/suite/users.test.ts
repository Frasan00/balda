import { describe, expect, it } from "vitest";
import { mockServer } from "../server/instance.js";

describe("UsersController", () => {
  it("GET /users returns all users", async () => {
    const res = await mockServer.get("/users");
    expect(res.statusCode()).toBe(200);
    expect(Array.isArray(res.body() as any)).toBe(true);
    expect((res.body() as any).length).toBeGreaterThan(0);
  });

  it("GET /users?shouldFail=true should fail", async () => {
    const res = await mockServer.get("/users", {
      query: { shouldFail: "true" },
    });
    expect(res.statusCode()).toBe(500);
  });

  it("GET /users/:id returns a user if found", async () => {
    const res = await mockServer.get("/users/1");
    expect(res.statusCode()).toBe(200);
    expect(res.assertBodySubset({ id: 1 }));
  });

  it("GET /users/:id returns 404 if not found", async () => {
    const res = await mockServer.get("/users/999");
    expect(res.statusCode()).toBe(404);
    expect(res.assertBodyDeepEqual({ error: "User not found" }));
  });

  it("POST /users creates a new user", async () => {
    const newUser = { id: 3, email: "new@example.com", name: "New", age: 30 };
    const res = await mockServer.post("/users", { body: newUser });
    expect(res.statusCode()).toBe(201);
    expect(res.assertBodyDeepEqual(newUser));
  });

  it("POST /users returns 409 if user exists", async () => {
    const existingUser = {
      id: 1,
      email: "john.doe@example.com",
      name: "John Doe",
      age: 20,
    };
    const res = await mockServer.post("/users", { body: existingUser });
    expect(res.statusCode()).toBe(409);
    expect(res.assertBodyDeepEqual({ error: "User already exists" }));
  });

  it("PATCH /users/:id updates a user", async () => {
    const res = await mockServer.patch("/users/1", {
      body: { name: "Updated" },
    });
    expect(res.statusCode()).toBe(200);
    expect(res.assertBodySubset({ id: 1, name: "Updated" }));
  });

  it("PATCH /users/:id returns 404 if not found", async () => {
    const res = await mockServer.patch("/users/999", {
      body: { name: "Nope" },
    });
    expect(res.statusCode()).toBe(404);
    expect(res.assertBodyDeepEqual({ error: "User not found" }));
  });

  it("DELETE /users/:id deletes a user", async () => {
    const res = await mockServer.delete("/users/1");
    expect(res.statusCode()).toBe(204);
  });

  it("DELETE /users/:id returns 404 if not found", async () => {
    const res = await mockServer.delete("/users/999");
    expect(res.statusCode()).toBe(404);
    expect(res.assertBodyDeepEqual({ error: "User not found" }));
  });

  it("GET /users/ajv returns all users using OpenAPI schema", async () => {
    const res = await mockServer.get("/users/ajv");
    expect(res.statusCode()).toBe(200);
    expect(Array.isArray(res.body() as any)).toBe(true);
    expect((res.body() as any).length).toBeGreaterThan(0);
  });

  it("GET /users/ajv?shouldFail=true should fail with OpenAPI schema", async () => {
    const res = await mockServer.get("/users/ajv", {
      query: { shouldFail: "true" },
    });
    expect(res.statusCode()).toBe(500);
  });

  it("GET /users/ajv/:id returns a user if found", async () => {
    const res = await mockServer.get("/users/ajv/2");
    expect(res.statusCode()).toBe(200);
    expect(res.assertBodySubset({ id: 2 }));
  });

  it("GET /users/ajv/:id returns 404 if not found", async () => {
    const res = await mockServer.get("/users/ajv/999");
    expect(res.statusCode()).toBe(404);
    expect(res.assertBodyDeepEqual({ error: "User not found" }));
  });

  it("POST /users/ajv creates a new user with AJV validation", async () => {
    const newUser = {
      id: 4,
      email: "ajv@example.com",
      name: "AJV User",
      age: 25,
    };
    const res = await mockServer.post("/users/ajv", { body: newUser });
    expect(res.statusCode()).toBe(201);
    expect(res.assertBodyDeepEqual(newUser));
  });

  it("POST /users/ajv returns 409 if user exists", async () => {
    const existingUser = {
      id: 5,
      email: "jane.doe@example.com",
      name: "Jane Doe",
      age: 21,
    };
    const res = await mockServer.post("/users/ajv", { body: existingUser });
    expect(res.statusCode()).toBe(409);
    expect(res.assertBodyDeepEqual({ error: "User already exists" }));
  });

  it("POST /users/ajv validates body schema", async () => {
    const invalidUser = { id: "not-a-number", email: "invalid-email" };
    const res = await mockServer.post("/users/ajv", { body: invalidUser });
    expect(res.statusCode()).toBe(500);
  });

  it("PATCH /users/ajv/:id updates a user with AJV validation", async () => {
    const res = await mockServer.patch("/users/ajv/2", {
      body: { name: "Updated via AJV" },
    });
    expect(res.statusCode()).toBe(200);
    expect(res.assertBodySubset({ id: 2, name: "Updated via AJV" }));
  });

  it("PATCH /users/ajv/:id returns 404 if not found", async () => {
    const res = await mockServer.patch("/users/ajv/999", {
      body: { name: "Nope" },
    });
    expect(res.statusCode()).toBe(404);
    expect(res.assertBodyDeepEqual({ error: "User not found" }));
  });

  it("PATCH /users/ajv/:id validates body schema", async () => {
    const invalidUpdate = { age: "not-a-number" };
    const res = await mockServer.patch("/users/ajv/2", { body: invalidUpdate });
    expect(res.statusCode()).toBe(500);
  });

  it("DELETE /users/ajv/:id deletes a user", async () => {
    const res = await mockServer.delete("/users/ajv/2");
    expect(res.statusCode()).toBe(204);
  });

  it("DELETE /users/ajv/:id returns 404 if not found", async () => {
    const res = await mockServer.delete("/users/ajv/999");
    expect(res.statusCode()).toBe(404);
    expect(res.assertBodyDeepEqual({ error: "User not found" }));
  });
});

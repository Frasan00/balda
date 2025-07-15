import { describe, it, expect } from "vitest";
import { mockServer } from "test/server";

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
});

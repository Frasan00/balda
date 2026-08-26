---
title: Policies
description: Type-safe authorization and access control with PolicyManager. Define reusable permission handlers for your application.
keywords: [balda, policies, authorization, access control, permissions]
sidebar_position: 6
---

# Policies

The Policy system in Balda provides a flexible, type-safe way to implement authorization and access control. Policies are organized by scope and allow you to define reusable authorization handlers that can be used throughout your application.

## Overview

The Policy system uses a `PolicyManager` class that manages multiple policy providers organized by scope. Each scope contains multiple handlers that determine whether a user or entity has access to perform specific actions.

## Basic Concepts

### Policy Provider

A policy provider is an object that contains multiple authorization handlers. Each handler is a function that takes any arguments and returns a boolean or `Promise<boolean>`.

```typescript
type PolicyProvider = {
  [K: string]: (...args: any[]) => Promise<boolean> | boolean;
};
```

### Policy Manager

The `PolicyManager` class manages multiple policy providers, each organized under a scope name. It provides a type-safe `canAccess` method to check permissions.

## Creating a Policy Manager

You can define multiple scopes, each with their own handlers:

```typescript
export const policyManager = new PolicyManager({
  users: {
    adminRoute: async (user: { id: string; role: string }) => {
      return user.role === "admin";
    },
    canView: async (
      user: { id: string; role: string },
      targetUserId: string,
    ) => {
      return user.id === targetUserId || user.role === "admin";
    },
    canEdit: async (
      user: { id: string; role: string },
      targetUserId: string,
    ) => {
      return user.id === targetUserId || user.role === "admin";
    },
    canDelete: async (user: { id: string; role: string }) => {
      return user.role === "admin";
    },
  },
  documents: {
    canView: async (
      user: { id: string; role: string },
      document: { id: string; ownerId: string; isPublic: boolean },
    ) => {
      if (document.isPublic) {
        return true;
      }
      return document.ownerId === user.id || user.role === "admin";
    },
    canEdit: async (
      user: { id: string; role: string },
      document: { id: string; ownerId: string },
    ) => {
      return document.ownerId === user.id || user.role === "admin";
    },
    canDelete: async (
      user: { id: string; role: string },
      document: { id: string; ownerId: string },
    ) => {
      return document.ownerId === user.id || user.role === "admin";
    },
    canShare: async (
      user: { id: string; role: string },
      document: { id: string; ownerId: string },
    ) => {
      return document.ownerId === user.id || user.role === "admin";
    },
  },
});
```

## Using the Policy Manager

### Checking Access

Use the `canAccess` method to check if a user has permission to perform an action:

```typescript
const user = { id: "1", name: "John", role: "admin" };

// Check if user can access admin route
const hasAccess = await policyManager.canAccess("test", "adminRoute", user); // type safe
if (hasAccess) {
  // User has access
}
```

## Policy Decorator

The policy decorator provides a declarative way to attach policy metadata to controllers and route handlers. This allows you to define authorization requirements directly on your classes and methods.

### Creating a Decorator

Create a type-safe decorator from your policy manager using the `createDecorator` method:

```typescript
export const policy = policyManager.createDecorator();
```

### Class-Level Policies

Apply policies to an entire controller class:

```typescript
@policy("users", "adminRoute")
class AdminController {
  // All routes in this controller require admin access
}
```

### Method-Level Policies

You can also apply policies to individual methods:

```typescript
class UserController {
  @policy("users", "canView")
  async getUser(req: Request, res: Response) {
    // Only users with 'canView' permission can access this route
  }

  @policy("users", "canEdit")
  async updateUser(req: Request, res: Response) {
    // Only users with 'canEdit' permission can access this route
  }

  @policy("users", "canDelete")
  async deleteUser(req: Request, res: Response) {
    // Only users with 'canDelete' permission can access this route
  }
}
```

### Combining Class and Method Policies

Policies can be stacked - class-level policies apply to all methods, and method-level policies add additional checks:

```typescript
@policy("users", "adminRoute")
class AdminController {
  @policy("documents", "canEdit")
  async editDocument(req: Request, res: Response) {
    // Requires both 'users.adminRoute' AND 'documents.canEdit' policies
  }
}
```

## Controller Example

```typescript
export const adminRoute = async (req: Request, res: Response) => {
  const user = req.user;
  const hasAccess = await policyManager.canAccess("users", "adminRoute", user);
  if (!hasAccess) {
    return res.forbidden({ message: "You do not have access to this route" });
  }

  return res.ok({ message: "You have access to this route" });
};
```

## Inline Route Policy Option

In addition to the decorator approach, you can apply policies directly when defining routes using the `policy` option in `StandardMethodOptions`. This works with `router.get()`, `router.post()`, and all other HTTP methods.

### Single Policy

```typescript
import { router, PolicyManager } from "balda";

const policyManager = new PolicyManager({
  auth: {
    isAdmin: async (req) => req.user?.role === "admin",
  },
});

router.get(
  "/admin/dashboard",
  {
    policy: { manager: policyManager, scope: "auth", handler: "isAdmin" },
  },
  (req, res) => {
    res.json({ dashboard: "admin data" });
  },
);
```

### Multiple Policies

Pass an array to enforce multiple policies — all must pass:

```typescript
router.post(
  "/admin/users",
  {
    policy: [
      { manager: policyManager, scope: "auth", handler: "isAdmin" },
      { manager: policyManager, scope: "auth", handler: "canManageUsers" },
    ],
    body: CreateUserSchema,
  },
  (req, res) => {
    res.created({ id: "123", ...req.body });
  },
);
```

### Combining with Middlewares

The `policy` option runs **before** route-level middlewares, matching the same execution order as the decorator approach:

```typescript
router.get(
  "/admin/reports",
  {
    policy: { manager: policyManager, scope: "auth", handler: "isAdmin" },
    middlewares: [logMiddleware],
    responses: { 200: ReportSchema },
  },
  (req, res) => {
    res.ok({ reports: [] });
  },
);
```

### Using with Route Groups

```typescript
router.group("/api/admin", [authMiddleware], (r) => {
  r.get(
    "/users",
    {
      policy: { manager: policyManager, scope: "auth", handler: "isAdmin" },
    },
    (req, res) => {
      res.json({ users: [] });
    },
  );
});
```

## Custom Policy Error Handler

By default, when a policy check fails, Balda responds with `401 Unauthorized` and `{ error: "Unauthorized" }`. You can customize this globally using `setPolicyErrorHandler`:

```typescript
import { Server } from "balda";

const server = new Server({ port: 3000 });

server.setPolicyErrorHandler((req, res) => {
  res.status(403).json({
    code: "FORBIDDEN",
    message: "You do not have permission to access this resource",
  });
});
```

This handler applies to all policy failures — both from decorators and inline route options.

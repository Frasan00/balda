---
title: generate-controller
description: Generate a new controller with RESTful route handlers. Creates CRUD endpoints for your resources.
keywords: [balda, generate controller, scaffold, rest, crud, routes]
sidebar_position: 10
---

# generate-controller

Generate a new controller with RESTful route handlers.

```bash
npx balda generate-controller user -p src/controllers
```

**Generated file:** `src/controllers/user.ts`

## Flags

- `-p, --path <string>`: Target directory (default `src/controllers`)

## Generated Code

The controller includes RESTful route handlers:

```ts
import { controller, get, post, put, del, Request, Response } from "balda";

@controller("/user")
export default class UserController {
  @get("/")
  async index(req: Request, res: Response) {
    return { message: "List all users" };
  }

  @get("/:id")
  async show(req: Request, res: Response) {
    return { message: `Get user with id ${req.params.id}` };
  }

  @post("/")
  async create(req: Request, res: Response) {
    return { message: "Create user", data: req.body };
  }

  @put("/:id")
  async update(req: Request, res: Response) {
    return { message: `Update user ${req.params.id}`, data: req.body };
  }

  @del("/:id")
  async destroy(req: Request, res: Response) {
    return { message: `Delete user ${req.params.id}` };
  }
}
```

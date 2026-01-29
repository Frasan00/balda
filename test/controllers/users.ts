import { Type } from "@sinclair/typebox";
import z from "zod";
import { controller } from "../../src/decorators/controller/controller.js";
import { del } from "../../src/decorators/handlers/del.js";
import { get } from "../../src/decorators/handlers/get.js";
import { patch } from "../../src/decorators/handlers/patch.js";
import { post } from "../../src/decorators/handlers/post.js";
import { serialize } from "../../src/decorators/serialize/serialize.js";
import { validate } from "../../src/index.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";

const UserIndexQuery = z.object({
  shouldFail: z.string().optional(),
});

const UserResponse = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  age: z.number(),
});

const ShouldFailResponse = z.object({
  impossibleField: z.string(),
});

const users = [
  {
    id: 1,
    email: "john.doe@example.com",
    name: "John Doe",
    age: 20,
  },
  {
    id: 2,
    email: "jane.doe@example.com",
    name: "Jane Doe",
    age: 21,
  },
];

// OpenAPI schemas for AJV compilation
const UserIndexQueryOpenApi = {
  type: "object",
  properties: {
    shouldFail: { type: "string" },
  },
  additionalProperties: false,
} as const;

const UserResponseOpenApi = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "number" },
      email: { type: "string", format: "email" },
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["id", "email", "name", "age"],
    additionalProperties: false,
  },
} as const;

const ShouldFailResponseOpenApi = {
  type: "object",
  properties: {
    impossibleField: { type: "string" },
  },
  required: ["impossibleField"],
  additionalProperties: false,
} as const;

const SingleUserResponseOpenApi = {
  type: "object",
  properties: {
    id: { type: "number" },
    email: { type: "string", format: "email" },
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["id", "email", "name", "age"],
  additionalProperties: false,
} as const;

const UserNotFoundResponseOpenApi = {
  type: "object",
  properties: {
    error: { type: "string", enum: ["User not found"] },
  },
  required: ["error"],
  additionalProperties: false,
} as const;

const UserAlreadyExistsResponseOpenApi = {
  type: "object",
  properties: {
    error: { type: "string", enum: ["User already exists"] },
  },
  required: ["error"],
  additionalProperties: false,
} as const;

const CreateUserBodyOpenApi = {
  type: "object",
  properties: {
    id: { type: "number" },
    email: { type: "string", format: "email" },
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["id", "email", "name", "age"],
  additionalProperties: false,
} as const;

const UpdateUserBodyOpenApi = {
  type: "object",
  properties: {
    id: { type: "number" },
    email: { type: "string", format: "email" },
    name: { type: "string" },
    age: { type: "number" },
  },
  additionalProperties: false,
} as const;

// TypeBox schemas
const UserIndexQueryTypeBox = Type.Object({
  shouldFail: Type.Optional(Type.String()),
});

const UserResponseTypeBox = Type.Object({
  id: Type.Number(),
  email: Type.String({ format: "email" }),
  name: Type.String(),
  age: Type.Number(),
});

const UserResponseArrayTypeBox = Type.Array(UserResponseTypeBox);

const ShouldFailResponseTypeBox = Type.Object({
  impossibleField: Type.String(),
});

const UserNotFoundResponseTypeBox = Type.Object({
  error: Type.Literal("User not found"),
});

const UserAlreadyExistsResponseTypeBox = Type.Object({
  error: Type.Literal("User already exists"),
});

const CreateUserBodyTypeBox = Type.Object({
  id: Type.Number(),
  email: Type.String({ format: "email" }),
  name: Type.String(),
  age: Type.Number(),
});

const UpdateUserBodyTypeBox = Type.Partial(
  Type.Object({
    id: Type.Number(),
    email: Type.String({ format: "email" }),
    name: Type.String(),
    age: Type.Number(),
  }),
);

@controller("/users")
export class UsersController {
  @get("/")
  @validate.query(UserIndexQuery)
  @serialize(z.array(UserResponse))
  @serialize(ShouldFailResponse, {
    status: 201,
    throwErrorOnValidationFail: true,
  })
  async index(
    _req: Request,
    res: Response,
    qs: z.infer<typeof UserIndexQuery>,
  ) {
    if (qs.shouldFail === "true") {
      return res.created(users);
    }

    res.json(users);
  }

  @get("/ajv")
  @validate.query(UserIndexQueryOpenApi)
  @serialize(UserResponseOpenApi)
  @serialize(ShouldFailResponseOpenApi, {
    status: 201,
    throwErrorOnValidationFail: true,
  })
  async indexAjv(_req: Request, res: Response, qs: { shouldFail?: string }) {
    if (qs.shouldFail === "true") {
      return res.created(users);
    }

    res.json(users);
  }

  @get("/ajv/:id")
  @serialize(SingleUserResponseOpenApi, { throwErrorOnValidationFail: true })
  @serialize(UserNotFoundResponseOpenApi, { status: 404 })
  async showAjv(req: Request<{ id: string }>, res: Response) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    res.ok(user);
  }

  @post("/ajv")
  @validate.body(CreateUserBodyOpenApi)
  @serialize(UserAlreadyExistsResponseOpenApi, { status: 409 })
  @serialize(SingleUserResponseOpenApi)
  async createAjv(
    _req: Request,
    res: Response,
    body: {
      id: number;
      email: string;
      name: string;
      age: number;
    },
  ) {
    const alreadyExists = users.find((user) => user.email === body.email);
    if (alreadyExists) {
      return res.conflict({ error: "User already exists" });
    }

    users.push(body);
    res.created(body);
  }

  @patch("/ajv/:id")
  @validate.body(UpdateUserBodyOpenApi)
  @serialize(UserNotFoundResponseOpenApi, { status: 404 })
  @serialize(SingleUserResponseOpenApi)
  async updateAjv(
    req: Request,
    res: Response,
    body: {
      id?: number;
      email?: string;
      name?: string;
      age?: number;
    },
  ) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    const updatedUser = { ...user, ...body };
    users.splice(users.indexOf(user), 1, updatedUser);
    res.ok(updatedUser);
  }

  @del("/ajv/:id")
  @serialize(UserNotFoundResponseOpenApi, { status: 404 })
  async destroyAjv(req: Request, res: Response) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    users.splice(users.indexOf(user), 1);
    res.noContent();
  }

  @get("/:id")
  @serialize(UserResponse, { throwErrorOnValidationFail: true })
  @serialize(z.object({ error: z.literal("User not found") }), {
    status: 404,
  })
  async show(req: Request<{ id: string }>, res: Response) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    res.ok(user);
  }

  @post("/")
  @validate.body(UserResponse)
  @serialize(z.object({ error: z.literal("User already exists") }), {
    status: 409,
  })
  @serialize(UserResponse)
  async create(
    _req: Request,
    res: Response,
    body: z.infer<typeof UserResponse>,
  ) {
    const alreadyExists = users.find((user) => user.email === body.email);
    if (alreadyExists) {
      return res.conflict({ error: "User already exists" });
    }

    users.push(body);
    res.created(body);
  }

  @patch("/:id")
  @validate.body(UserResponse.partial())
  @serialize(z.object({ error: z.literal("User not found") }), {
    status: 404,
  })
  @serialize(UserResponse)
  async update(
    req: Request,
    res: Response,
    body: z.infer<typeof UserResponse>,
  ) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    const updatedUser = { ...user, ...body };
    users.splice(users.indexOf(user), 1, updatedUser);
    res.ok(updatedUser);
  }

  @del("/:id")
  @serialize(z.object({ error: z.literal("User not found") }), {
    status: 404,
  })
  async destroy(req: Request, res: Response) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    users.splice(users.indexOf(user), 1);
    res.noContent();
  }

  @get("/typebox")
  @validate.query(UserIndexQueryTypeBox)
  @serialize(UserResponseArrayTypeBox)
  @serialize(ShouldFailResponseTypeBox, {
    status: 201,
    throwErrorOnValidationFail: true,
  })
  async indexTypeBox(
    _req: Request,
    res: Response,
    qs: { shouldFail?: string },
  ) {
    if (qs.shouldFail === "true") {
      return res.created(users);
    }

    res.json(users);
  }

  @get("/typebox/:id")
  @serialize(UserResponseTypeBox, { throwErrorOnValidationFail: true })
  @serialize(UserNotFoundResponseTypeBox, { status: 404 })
  async showTypeBox(req: Request<{ id: string }>, res: Response) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    res.ok(user);
  }

  @post("/typebox")
  @validate.body(CreateUserBodyTypeBox)
  @serialize(UserAlreadyExistsResponseTypeBox, { status: 409 })
  @serialize(UserResponseTypeBox)
  async createTypeBox(
    _req: Request,
    res: Response,
    body: {
      id: number;
      email: string;
      name: string;
      age: number;
    },
  ) {
    const alreadyExists = users.find((user) => user.email === body.email);
    if (alreadyExists) {
      return res.conflict({ error: "User already exists" });
    }

    users.push(body);
    res.created(body);
  }

  @patch("/typebox/:id")
  @validate.body(UpdateUserBodyTypeBox)
  @serialize(UserNotFoundResponseTypeBox, { status: 404 })
  @serialize(UserResponseTypeBox)
  async updateTypeBox(
    req: Request,
    res: Response,
    body: {
      id?: number;
      email?: string;
      name?: string;
      age?: number;
    },
  ) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    const updatedUser = { ...user, ...body };
    users.splice(users.indexOf(user), 1, updatedUser);
    res.ok(updatedUser);
  }

  @del("/typebox/:id")
  @serialize(UserNotFoundResponseTypeBox, { status: 404 })
  async destroyTypeBox(req: Request, res: Response) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    users.splice(users.indexOf(user), 1);
    res.noContent();
  }
}

import { controller } from "src/decorators/controller/controller";
import { del } from "src/decorators/handlers/del";
import { get } from "src/decorators/handlers/get";
import { patch } from "src/decorators/handlers/patch";
import { post } from "src/decorators/handlers/post";
import { serialize } from "src/decorators/serialize/serialize";
import { validate } from "src/index";
import { Request } from "src/server/http/request";
import { Response } from "src/server/http/response";
import z from "zod";

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

@controller("/users")
export class UsersController {
  @get("/")
  @validate.query(UserIndexQuery)
  @serialize(z.array(UserResponse))
  @serialize(ShouldFailResponse, { status: 201, safe: false })
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

  @get("/:id")
  @serialize(UserResponse, { safe: false })
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
}

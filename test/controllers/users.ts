import { controller } from "src/decorators/controller/controller";
import { get } from "src/decorators/handlers/get";
import { post } from "src/decorators/handlers/post";
import { patch } from "src/decorators/handlers/patch";
import { del } from "src/decorators/handlers/del";
import { Request } from "src/server/http/request";
import { Response } from "src/server/http/response";
import { serialize } from "src/decorators/serialize/serialize";
import { Type, Static } from "@sinclair/typebox";
import { validate } from "src/index";

const users = [
  { id: 1, email: "john.doe@example.com", name: "John Doe", age: 20 },
  { id: 2, email: "jane.doe@example.com", name: "Jane Doe", age: 21 },
];

const UserIndexQuery = Type.Object({
  shouldFail: Type.Optional(Type.String({ default: "false" })),
});

const UserResponse = Type.Object({
  id: Type.Number(),
  email: Type.String(),
  name: Type.String(),
  age: Type.Number(),
});

const ShouldFailResponse = Type.Object({
  impossibleField: Type.String(),
});

@controller("/users")
export class UsersController {
  @get("/")
  @validate.query(UserIndexQuery)
  @serialize(Type.Array(UserResponse))
  @serialize(ShouldFailResponse, { status: 201, safe: false })
  async index(_req: Request, res: Response, qs: Static<typeof UserIndexQuery>) {
    if (qs.shouldFail === "true") {
      return res.created(users);
    }

    res.json(users);
  }

  @get("/:id")
  @serialize(UserResponse)
  @serialize(Type.Object({ error: Type.Literal("User not found") }), { status: 404 })
  async show(req: Request, res: Response) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    res.ok(user);
  }

  @post("/")
  @validate.body(UserResponse)
  @serialize(Type.Object({ error: Type.Literal("User already exists") }), { status: 409 })
  @serialize(UserResponse)
  async create(
    _req: Request,
    res: Response,
    body: Static<typeof UserResponse>
  ) {
    const alreadyExists = users.find((user) => user.email === body.email);
    if (alreadyExists) {
      return res.conflict({ error: "User already exists" });
    }

    users.push(body);
    res.created(body);
  }

  @patch("/:id")
  @validate.body(Type.Partial(UserResponse))
  @serialize(Type.Object({ error: Type.Literal("User not found") }), { status: 404 })
  @serialize(UserResponse)
  async update(req: Request, res: Response, body: Static<typeof UserResponse>) {
    const user = users.find((user) => user.id === Number(req.params.id));
    if (!user) {
      return res.notFound({ error: "User not found" });
    }

    const updatedUser = { ...user, ...body };
    users.splice(users.indexOf(user), 1, updatedUser);
    res.ok(updatedUser);
  }

  @del("/:id")
  @serialize(Type.Object({ error: Type.Literal("User not found") }), {
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

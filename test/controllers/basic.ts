import { validate } from "src/decorators/validation/validate";
import { controller, get, middleware, post, urlencoded } from "../../src/index";
import { Request } from "../../src/server/http/request";
import { Response } from "../../src/server/http/response";
import { type Static, Type } from "@sinclair/typebox";

const SearchSchema = Type.Object({
  search: Type.String(),
});

@controller("/basic")
export class BasicController {
  @get("/")
  @validate.query(SearchSchema)
  async get(_req: Request, res: Response, query: Static<typeof SearchSchema>) {
    const { search } = query;
    res.ok({ message: search });
  }

  @post("/www")
  @middleware(urlencoded())
  async post(req: Request, res: Response) {
    res.ok({ message: req.body });
  }
}

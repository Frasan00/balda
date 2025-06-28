import { validate } from "src/decorators/validation/validate";
import { controller, get } from "../../src/index";
import { Request } from "../../src/server/http/request";
import { Response } from "../../src/server/http/response";
import { Static, Type } from "@sinclair/typebox";

const SearchSchema = Type.Object({
  search: Type.String(),
});

@controller("/basic")
export class BasicController {
  @get("/", {
    query: SearchSchema,
    responses: {
      200: SearchSchema,
    },
  })
  @validate.query(SearchSchema)
  async get(_req: Request, res: Response, query: Static<typeof SearchSchema>) {
    const { search } = query;
    res.ok({ message: search });
  }
}

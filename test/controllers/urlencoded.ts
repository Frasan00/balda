import { controller, middleware, post } from "../../src/index.js";
import { urlencoded } from "../../src/plugins/urlencoded/urlencoded.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";

@controller("/urlencoded")
export class UrlencodedController {
  @post("/", { bodyType: "urlencoded" })
  @middleware(urlencoded())
  async urlencoded(req: Request, res: Response) {
    res.ok(req.body);
  }
}

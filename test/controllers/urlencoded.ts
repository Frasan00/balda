import { controller, middleware, post } from "../../src/index";
import { Request } from "../../src/server/http/request";
import { Response } from "../../src/server/http/response";
import { urlencoded } from "src/plugins/urlencoded/urlencoded";

@controller("/urlencoded")
export class UrlencodedController {
  @post("/")
  @middleware(urlencoded())
  async urlencoded(req: Request, res: Response) {
    res.ok(req.body);
  }
}

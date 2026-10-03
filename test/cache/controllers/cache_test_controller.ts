import { controller } from "../../src/decorators/controller/controller.js";
import { get } from "../../src/decorators/handlers/get.js";
import { post } from "../../src/decorators/handlers/post.js";
import { cache } from "../../src/decorators/cache/cache.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";
import { incrementCallCount } from "./cache_counter.js";

@controller("/cache-test")
export class CacheTestController {
  /** Simple GET — cached with default TTL */
  @get("/items")
  @cache({ ttl: 60 })
  async list(_req: Request, res: Response) {
    incrementCallCount();
    res.json({ items: ["a", "b", "c"] });
  }

  /** GET with route params — params are always part of the key */
  @get("/items/:id")
  @cache({ ttl: 60 })
  async show(req: Request<{ id: string }>, res: Response) {
    incrementCallCount();
    res.json({ id: req.params.id });
  }

  /** POST — cached including body */
  @post("/search")
  @cache({ ttl: 60, include: { body: true } })
  async search(req: Request, res: Response) {
    incrementCallCount();
    res.json({ results: ["x", "y"], query: req.body });
  }

  /** GET — cached including query params */
  @get("/filtered")
  @cache({ ttl: 60, include: { query: true } })
  async filtered(req: Request, res: Response) {
    incrementCallCount();
    res.json({ filter: req.query });
  }
}

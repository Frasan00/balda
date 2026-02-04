import { cache, controller, get } from "../../src/index.js";
import type { Request } from "../../src/server/http/request.js";
import type { Response } from "../../src/server/http/response.js";

@controller("/cached")
export class CachedController {
  private callCount = 0;

  @get("/profile")
  @cache({ ttl: 5000 })
  getProfile(_req: Request, res: Response) {
    this.callCount++;
    res.json({
      timestamp: Date.now(),
      data: "profile",
      callCount: this.callCount,
    });
  }

  @get("/user/:id")
  @cache({ ttl: 5000 })
  getUser(req: Request<{ id: string }>, res: Response) {
    this.callCount++;
    res.json({
      id: req.params.id,
      timestamp: Date.now(),
      callCount: this.callCount,
    });
  }

  @get("/search")
  @cache({ ttl: 5000, includeQuery: true })
  search(req: Request, res: Response) {
    this.callCount++;
    res.json({
      query: req.query,
      timestamp: Date.now(),
      callCount: this.callCount,
    });
  }

  @get("/custom-key")
  @cache({ key: "static-custom-key", ttl: 5000 })
  customKey(_req: Request, res: Response) {
    this.callCount++;
    res.json({
      timestamp: Date.now(),
      callCount: this.callCount,
    });
  }

  @get("/no-cache")
  noCache(_req: Request, res: Response) {
    this.callCount++;
    res.json({
      timestamp: Date.now(),
      callCount: this.callCount,
    });
  }

  @get("/short-ttl")
  @cache({ ttl: 100 })
  shortTtl(_req: Request, res: Response) {
    this.callCount++;
    res.json({
      timestamp: Date.now(),
      callCount: this.callCount,
    });
  }
}

// This should throw an error when controller is registered
// Uncomment to test error handling
// @controller("/invalid-cache")
// export class InvalidCacheController {
//   @post("/create")
//   @cache({ ttl: 5000 })
//   createItem(_req: Request, res: Response) {
//     res.json({ error: "This should never be called" });
//   }
// }

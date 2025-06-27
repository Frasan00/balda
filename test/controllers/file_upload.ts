import { Type } from "@sinclair/typebox";
import { get } from "node:http";
import { controller, post } from "../../src/index";
import { Request } from "../../src/server/http/request";
import { Response } from "../../src/server/http/response";

@controller()
class FileUploadController {
  @post("/file")
  async file(req: Request, res: Response) {
    const file = req.file("file");
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.text("File uploaded");
  }
}

import { Type } from "@sinclair/typebox";
import { get } from "node:http";
import { controller, middleware, post } from "../../src/index";
import { Request } from "../../src/server/http/request";
import { Response } from "../../src/server/http/response";
import { fileParser } from "src/plugins/file/file";

@controller("/file")
export class FileUploadController {
  @post("/upload")
  @middleware(fileParser())
  async file(req: Request, res: Response) {
    const file = req.file("file");
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    res.json({
      originalName: file.originalName,
      filename: file.formName,
      size: file.size,
      mimetype: file.mimeType,
    });
  }
}

import { controller, post } from "../../src/index.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";

@controller("/file")
export class FileUploadController {
  @post("/upload", { bodyType: "form-data" })
  async file(req: Request, res: Response) {
    const file = req.file("file");
    if (!file) {
      return res.badRequest({ error: "No file uploaded" });
    }

    res.ok({
      originalName: file.originalName,
      filename: file.formName,
      size: file.size,
      mimetype: file.mimeType,
      otherFields: req.body,
    });
  }
}

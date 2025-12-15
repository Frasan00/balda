import z from "zod";
import { controller, middleware, post } from "../../src/index.js";
import { fileParser } from "../../src/plugins/file/file.js";
import { Request } from "../../src/server/http/request.js";
import { Response } from "../../src/server/http/response.js";

const FileUploadBody = z.object({
  file: z.instanceof(Uint8Array),
});

@controller("/file")
export class FileUploadController {
  @post("/upload", { bodyType: "form-data", requestBody: FileUploadBody })
  @middleware(fileParser())
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

import { Type } from "@sinclair/typebox";
import { Server } from "../src/server/server";
import { nativeFs } from "src/runtime/native_fs";

const server = new Server({
  controllerPatterns: ["./test/controllers/**/*.{ts,js}"],
  logger: {
    level: "debug",
  },
  plugins: {
    static: "public",
  },
});

server.get(
  "/",
  {
    swagger: {
      service: "Test API",
      responses: {
        200: Type.String(),
      },
    },
  },
  (req, res) => {
    console.log(req.ip);
    res.text("Hello, world!");
  }
);

(async () => {
  const mockServer = await server.getMockServer();
  const fileBuffer = await nativeFs.readFile("./test/resources/test.txt");
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: "text/plain" });
  const formData = new FormData();
  formData.append("file", blob, "test.txt");
  formData.append("file2", "test2");

  const response = await mockServer.post("/file/upload", {
    formData,
  });

  response.assertStatus(200);
})();

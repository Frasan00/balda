import { Command } from "src/commands/base_command";
import { arg } from "src/decorators/command/arg";
import { flag } from "src/decorators/command/flag";
import { nativeFs } from "src/runtime/native_fs";
import { nativePath } from "src/runtime/native_path";
import { toPascalCase } from "src/utils";

export default class GenerateMiddlewareCommand extends Command {
  static commandName = "generate-middleware";
  static description = "Generate a new middleware in the specified path";
  static help = [
    "Generate a new middleware in the specified path",
    "Example: npx balda generate-middleware auth -p src/middlewares",
  ];

  @arg({
    description: "The name of the middleware to generate",
    required: true,
  })
  static middlewareName: string;

  @flag({
    description:
      "The path to the middleware to generate, default is src/middlewares",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/middlewares",
  })
  static path: string;

  static async handle(): Promise<void> {
    const middlewareTemplate = this.getMiddlewareTemplate();
    const fileName = `${this.middlewareName.toLowerCase()}.ts`;
    this.path = nativePath.join(this.path, fileName);

    if (!(await nativeFs.exists(nativePath.join(process.cwd(), this.path)))) {
      await nativeFs.mkdir(
        nativePath.join(
          process.cwd(),
          this.path.split("/").slice(0, -1).join("/"),
        ),
        { recursive: true },
      );
    }

    await nativeFs.writeFile(
      this.path,
      new TextEncoder().encode(middlewareTemplate),
    );

    this.logger.info(
      `Middleware ${this.middlewareName} created successfully at ${this.path}`,
    );
  }

  static getMiddlewareTemplate() {
    const middlewareName = toPascalCase(this.middlewareName);
    return `import type { Request, Response, NextFunction, ServerRouteMiddleware } from "balda-js";

/**
 * ${middlewareName} middleware
 * @description Add your middleware logic here
 */
export const ${middlewareName}: ServerRouteMiddleware = async () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Add your middleware logic here
    return next();
  };
};`;
  }
}

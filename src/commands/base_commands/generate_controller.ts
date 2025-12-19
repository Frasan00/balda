import { arg } from "../../decorators/command/arg.js";
import { flag } from "../../decorators/command/flag.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { toDashCase, toPascalCase } from "../../utils.js";
import { Command } from "../base_command.js";

export default class GenerateControllerCommand extends Command {
  static commandName = "generate-controller";
  static description = "Generate a new controller in the specified path";
  static help = [
    "Generate a new controller in the specified path",
    "Example: npx balda generate-controller user -p src/controllers",
  ];

  @arg({
    description: "The name of the controller to generate",
    required: true,
  })
  static controllerName: string;

  @flag({
    description:
      "The path to the controller to generate, default is src/controllers",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/controllers",
  })
  static path: string;

  static async handle(): Promise<void> {
    const controllerTemplate = this.getControllerTemplate();
    const fileName = `${this.controllerName.toLowerCase()}.ts`;
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
      new TextEncoder().encode(controllerTemplate),
    );

    this.logger.info(
      `Controller ${this.controllerName} created successfully at ${this.path}`,
    );
  }

  static getControllerTemplate() {
    const className = toPascalCase(this.controllerName);
    return `import { controller, get, post, put, del, Request, Response } from "balda";

@controller("/${toDashCase(this.controllerName)}")
export default class ${className}Controller {
  @get("/")
  async index(req: Request, res: Response) {
    return { message: "List all ${this.controllerName.toLowerCase()}s" };
  }

  @get("/:id")
  async show(req: Request, res: Response) {
    return { message: \`Get ${this.controllerName.toLowerCase()} with id \${req.params.id}\` };
  }

  @post("/")
  async create(req: Request, res: Response) {
    return { message: \`Create ${this.controllerName.toLowerCase()}\`, data: req.body };
  }

  @put("/:id")
  async update(req: Request, res: Response) {
    return { message: \`Update ${this.controllerName.toLowerCase()} with id \${req.params.id}\`, data: req.body };
  }

  @del("/:id")
  async destroy(req: Request, res: Response) {
    return { message: \`Delete ${this.controllerName.toLowerCase()} with id \${req.params.id}\` };
  }
}`;
  }
}

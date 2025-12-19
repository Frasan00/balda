import { arg } from "../../decorators/command/arg.js";
import { flag } from "../../decorators/command/flag.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { Command } from "../base_command.js";

export default class GeneratePluginCommand extends Command {
  static commandName = "generate-plugin";
  static description = "Generate a new plugin in the specified path";
  static help = [
    "Generate a new plugin in the specified path",
    "Example: npx balda generate-plugin my-plugin -p src/plugins",
  ];

  @arg({
    description: "The name of the plugin to generate",
    required: true,
  })
  static pluginName: string;

  @flag({
    description: "The path to the plugin to generate, default is src/plugins",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/plugins",
  })
  static pluginPath: string;

  static async handle(): Promise<void> {
    const pluginTemplate = this.getPluginTemplate();
    this.pluginPath = nativePath.join(this.pluginPath, `${this.pluginName}.ts`);

    if (
      !(await nativeFs.exists(nativePath.join(process.cwd(), this.pluginPath)))
    ) {
      await nativeFs.mkdir(
        nativePath.join(
          process.cwd(),
          this.pluginPath.split("/").slice(0, -1).join("/"),
        ),
        { recursive: true },
      );
    }

    await nativeFs.writeFile(
      this.pluginPath,
      new TextEncoder().encode(pluginTemplate),
    );

    this.logger.info(
      `Plugin ${this.name} created successfully at ${this.pluginPath}`,
    );
  }

  static getPluginTemplate() {
    return `import { BasePlugin, Request, Response, NextFunction, ServerRouteMiddleware } from "balda";

export default class extends BasePlugin {
  async handle(): Promise<ServerRouteMiddleware> {
    return async (req: Request, res: Response, next: NextFunction) => {
      console.log("${this.pluginName} plugin is running");
      await next();
    };
  }
}`;
  }
}

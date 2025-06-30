import { join } from "node:path";
import { Command } from "src/commands/base_command";
import { arg } from "src/decorators/command/arg";
import { flag } from "src/decorators/command/flag";
import { nativeFs } from "src/runtime/native_fs";

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
  declare static pluginName: string;

  @flag({
    description: "The path to the plugin to generate, default is src/plugins",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/plugins",
  })
  declare static pluginPath: string;

  static async handle(): Promise<void> {
    const pluginTemplate = this.getPluginTemplate();
    this.pluginPath = join(this.pluginPath, `${this.pluginName}.ts`);
    await nativeFs.writeFile(
      this.pluginPath,
      new TextEncoder().encode(pluginTemplate)
    );

    this.logger.info(
      `Plugin ${this.name} created successfully at ${this.pluginPath}`
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

import { flag } from "../../decorators/command/flag.js";
import { BaldaError } from "../../errors/balda_error.js";
import { nativeCwd } from "../../runtime/native_cwd.js";
import { nativePath } from "../../runtime/native_path.js";
import { router } from "../../server/router/router.js";
import { Command } from "../base_command.js";

export default class RoutesListCommand extends Command {
  static commandName = "routes-list";
  static description = "List all routes defined";
  static help = [
    "Display all routes defined in the project",
    "Example: npx balda routes-list",
  ];

  @flag.string({
    aliases: ["e", "s"],
    name: "entry",
    required: false,
    defaultValue: "./src/index.ts",
    description: "The entry point of the project, default is ./src/index.ts",
  })
  static entry: string;

  static async handle(): Promise<void> {
    await import(nativePath.resolve(nativeCwd.getCwd(), this.entry)).catch(
      () => {
        throw new BaldaError(
          `Could not import entry path ${this.entry}, make sure to give a valid path to this command`,
        );
      },
    );

    const routes = router.getRoutes();

    if (!routes.length) {
      console.log("No routes found.");
      return;
    }

    // ANSI colors
    const colors = {
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      dim: "\x1b[2m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      red: "\x1b[31m",
      cyan: "\x1b[36m",
      gray: "\x1b[90m",
    };

    const methodColors: Record<string, string> = {
      GET: colors.green,
      POST: colors.yellow,
      PUT: colors.blue,
      PATCH: colors.magenta,
      DELETE: colors.red,
      OPTIONS: colors.cyan,
      HEAD: colors.gray,
    };

    const methodOrder = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ];
    const sortedRoutes = routes.slice().sort((a, b) => {
      const methodCompare =
        methodOrder.indexOf(a.method) - methodOrder.indexOf(b.method);
      if (methodCompare !== 0) {
        return methodCompare;
      }
      return a.path.localeCompare(b.path);
    });

    console.log(`\n${colors.bold}✨ Registered Routes:${colors.reset}\n`);

    const maxMethodLength = 7;
    const maxPathLength = Math.min(
      Math.max(...sortedRoutes.map((r) => r.path.length)),
      50,
    );

    sortedRoutes.forEach((route) => {
      const color = methodColors[route.method] || colors.reset;
      const method = route.method.padEnd(maxMethodLength);
      const path = route.path.padEnd(maxPathLength);

      // Build info parts
      const infoParts: string[] = [];

      // Handler name - always show it
      const handlerName = route.handler.name || "anonymous";
      infoParts.push(`${colors.dim}${handlerName}${colors.reset}`);

      // Middleware count
      if (route.middleware.length > 0) {
        infoParts.push(
          `${colors.cyan}${route.middleware.length} middleware${colors.reset}`,
        );
      }

      // Swagger metadata
      if (route.swaggerOptions) {
        const swagger = route.swaggerOptions;

        if (swagger.service) {
          infoParts.push(`${colors.blue}[${swagger.service}]${colors.reset}`);
        }

        if (swagger.name) {
          infoParts.push(`${colors.dim}"${swagger.name}"${colors.reset}`);
        }

        if (swagger.deprecated) {
          infoParts.push(`${colors.red}[DEPRECATED]${colors.reset}`);
        }

        if (swagger.security) {
          infoParts.push(`${colors.yellow}🔒 secured${colors.reset}`);
        }
      }

      // Build the output line
      const info =
        infoParts.length > 0
          ? ` ${colors.dim}│${colors.reset} ${infoParts.join(" ")}`
          : "";
      console.log(`  ${color}${method}${colors.reset} ${path}${info}`);
    });

    console.log(
      `\n${colors.bold}Total: ${routes.length} routes${colors.reset}\n`,
    );
  }
}

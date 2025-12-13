import { Command } from "src/commands/base_command";
import { flag } from "src/decorators/command/flag";
import { nativeFs } from "src/runtime/native_fs";
import { getPackageManager } from "src/package";
import { execSync } from "node:child_process";

export default class InitCommand extends Command {
  static commandName = "init";
  static description =
    "Initialize a new balda project in the current directory";
  static help = [
    "Initialize a new balda project, it is given for granted that balda-js is installed in the project as a dependency",
    "All the files are created in the /src directory (created if not exists)",
    "It adds a server.ts for the file instance and a index.ts for the entry point with a dummy hello world route",
    "Example: npx balda init -p ./src -t true",
  ];

  @flag.string({
    description:
      "The path to the project, default is the current directory /src",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "./src",
  })
  static srcPath: string;

  @flag.boolean({
    description: "Whether to use typescript, default is true",
    aliases: "t",
    name: "typescript",
    required: false,
    defaultValue: true,
  })
  static typescript: boolean;

  static devDependencies: string[] = [
    "esbuild",
    "esbuild-plugin-copy",
    "tsx",
    "typescript",
  ];

  static async handle(): Promise<void> {
    this.logger.info("Initializing project...");
    const [packageManager, packageManagerCommand, devDependenciesCommand] =
      await getPackageManager();

    // if the package manager is npm, yarn or pnpm, install the dev dependencies since we're on node.js
    if (["npm", "yarn", "pnpm"].includes(packageManager)) {
      this.logger.info(`Installing dev dependencies with ${packageManager}...`);

      execSync(
        `${packageManager} ${packageManagerCommand} ${this.devDependencies.join(" ")} -${devDependenciesCommand}`,
        {
          stdio: "inherit",
        },
      );
    }

    const ext = this.typescript ? "ts" : "js";
    const serverTemplate = this.getServerTemplate();
    const indexTemplate = this.getIndexTemplate();

    if (!nativeFs.exists(this.srcPath)) {
      await nativeFs.mkdir(this.srcPath, { recursive: true });
    }

    this.logger.info(`Creating server.${ext} file...`);
    await nativeFs.writeFile(
      `${this.srcPath}/server.${ext}`,
      new TextEncoder().encode(serverTemplate),
    );

    this.logger.info(`Creating index.${ext} file...`);
    await nativeFs.writeFile(
      `${this.srcPath}/index.${ext}`,
      new TextEncoder().encode(indexTemplate),
    );

    this.logger.info(`Project initialized successfully!`);
  }

  static getServerTemplate() {
    return `import { Server } from "balda-js";

const serverInstance = new Server({
  port: 80,
  host: "0.0.0.0",
  plugins: {
    json: {
      sizeLimit: "2mb",
    },
  },
});

export { serverInstance as server };
`;
  }

  static getIndexTemplate() {
    return `import { server } from "./server";

server.listen(({ url }) => {
  console.log(\`Server is running on \${url}\`);
});
`;
  }
}

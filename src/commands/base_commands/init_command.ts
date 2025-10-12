import { Command } from "src/commands/base_command";
import { flag } from "src/decorators/command/flag";
import { nativeFs } from "src/runtime/native_fs";

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

  static async handle(): Promise<void> {
    const ext = this.typescript ? "ts" : "js";
    const serverTemplate = this.getServerTemplate();
    const indexTemplate = this.getIndexTemplate();

    if (!nativeFs.exists(this.srcPath)) {
      await nativeFs.mkdir(this.srcPath, { recursive: true });
    }

    await nativeFs.writeFile(
      `${this.srcPath}/server.${ext}`,
      new TextEncoder().encode(serverTemplate),
    );

    await nativeFs.writeFile(
      `${this.srcPath}/index.${ext}`,
      new TextEncoder().encode(indexTemplate),
    );
  }

  static getServerTemplate() {
    return `import { Server } from "balda-js";

const serverInstance = new Server({
  port: 80,
  host: "0.0.0.0",
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

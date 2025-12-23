import { flag } from "../../decorators/command/flag.js";
import {
  execWithPrompt,
  getPackageManager,
  getUninstalledPackages,
} from "../../package.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { Command } from "../base_command.js";

export default class InitCommand extends Command {
  static commandName = "init";
  static description =
    "Initialize a new balda project in the current directory";
  static help = [
    "Initialize a new balda project, it is given for granted that balda is installed in the project as a dependency",
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

  @flag.boolean({
    description: "Initialize MQTT service connection",
    aliases: "m",
    name: "mqtt",
    required: false,
    defaultValue: false,
  })
  static mqtt: boolean;

  @flag.boolean({
    description: "Initialize Cron service",
    aliases: "c",
    name: "cron",
    required: false,
    defaultValue: false,
  })
  static cron: boolean;

  @flag.boolean({
    description: "Initialize GraphQL service",
    aliases: "g",
    name: "graphql",
    required: false,
    defaultValue: false,
  })
  static graphql: boolean;

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
      const uninstalledDevDeps = await getUninstalledPackages(
        this.devDependencies,
      );

      if (uninstalledDevDeps.length) {
        this.logger.info(
          `Found ${uninstalledDevDeps.length} missing dev dependencies`,
        );
        const installed = await execWithPrompt(
          `${packageManager} ${packageManagerCommand} ${uninstalledDevDeps.join(" ")} -${devDependenciesCommand}`,
          packageManager,
          uninstalledDevDeps,
          {
            stdio: "inherit",
          },
        );

        if (!installed) {
          this.logger.info(
            "Installation cancelled by user. Project initialization aborted.",
          );
          return;
        }
      }

      if (!uninstalledDevDeps.length) {
        this.logger.info("All dev dependencies are already installed");
      }
    }

    // Handle optional service dependencies
    if (this.mqtt && ["npm", "yarn", "pnpm"].includes(packageManager)) {
      const uninstalledMqtt = await getUninstalledPackages(["mqtt"]);

      if (uninstalledMqtt.length) {
        const mqttInstalled = await execWithPrompt(
          `${packageManager} ${packageManagerCommand} mqtt`,
          packageManager,
          ["mqtt"],
          {
            stdio: "inherit",
          },
          false,
        );

        if (!mqttInstalled) {
          this.logger.info(
            "MQTT installation cancelled by user. Skipping MQTT scaffolding.",
          );
          this.mqtt = false;
        }
      }

      if (!uninstalledMqtt.length) {
        this.logger.info("MQTT package is already installed");
      }
    }

    if (this.cron && ["npm", "yarn", "pnpm"].includes(packageManager)) {
      const uninstalledCron = await getUninstalledPackages(["node-cron"]);

      if (uninstalledCron.length > 0) {
        const cronInstalled = await execWithPrompt(
          `${packageManager} ${packageManagerCommand} node-cron`,
          packageManager,
          ["node-cron"],
          {
            stdio: "inherit",
          },
          false,
        );

        if (!cronInstalled) {
          this.logger.info(
            "node-cron installation cancelled by user. Skipping Cron scaffolding.",
          );
          this.cron = false;
        }
      }

      if (!uninstalledCron.length) {
        this.logger.info("node-cron package is already installed");
      }
    }

    if (this.graphql && ["npm", "yarn", "pnpm"].includes(packageManager)) {
      const uninstalledGraphql = await getUninstalledPackages([
        "@apollo/server",
        "graphql",
      ]);

      if (uninstalledGraphql.length > 0) {
        const graphqlInstalled = await execWithPrompt(
          `${packageManager} ${packageManagerCommand} ${uninstalledGraphql.join(" ")}`,
          packageManager,
          uninstalledGraphql,
          {
            stdio: "inherit",
          },
          false,
        );

        if (!graphqlInstalled) {
          this.logger.info(
            "GraphQL installation cancelled by user. Skipping GraphQL scaffolding.",
          );
          this.graphql = false;
        }
      }

      if (!uninstalledGraphql.length) {
        this.logger.info("GraphQL packages are already installed");
      }
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

    // Create MQTT configuration if requested
    if (this.mqtt) {
      const mqttDir = nativePath.join(this.srcPath, "mqtt");
      if (!(await nativeFs.exists(mqttDir))) {
        await nativeFs.mkdir(mqttDir, { recursive: true });
      }

      const mqttConfigTemplate = this.getMqttConfigTemplate();
      this.logger.info(`Creating mqtt/mqtt.config.${ext} file...`);
      await nativeFs.writeFile(
        nativePath.join(mqttDir, `mqtt.config.${ext}`),
        new TextEncoder().encode(mqttConfigTemplate),
      );
    }

    // Create Cron configuration if requested
    if (this.cron) {
      const cronDir = nativePath.join(this.srcPath, "cron");
      if (!(await nativeFs.exists(cronDir))) {
        await nativeFs.mkdir(cronDir, { recursive: true });
      }

      const cronConfigTemplate = this.getCronConfigTemplate();
      this.logger.info(`Creating cron/cron.config.${ext} file...`);
      await nativeFs.writeFile(
        nativePath.join(cronDir, `cron.config.${ext}`),
        new TextEncoder().encode(cronConfigTemplate),
      );
    }

    // Create GraphQL configuration if requested
    if (this.graphql) {
      const graphqlDir = nativePath.join(this.srcPath, "graphql");
      if (!(await nativeFs.exists(graphqlDir))) {
        await nativeFs.mkdir(graphqlDir, { recursive: true });
      }

      const graphqlConfigTemplate = this.getGraphqlConfigTemplate();
      this.logger.info(`Creating graphql/graphql.config.${ext} file...`);
      await nativeFs.writeFile(
        nativePath.join(graphqlDir, `graphql.config.${ext}`),
        new TextEncoder().encode(graphqlConfigTemplate),
      );
    }

    this.logger.info(`Project initialized successfully!`);
  }

  static getServerTemplate() {
    const graphqlConfig = this.graphql
      ? `,
  graphql: {
    schema: {
      typeDefs: \`
        type Query {
          hello: String
        }
      \`,
      resolvers: {
        Query: {
          hello: () => "Hello from GraphQL!"
        }
      }
    }
  }`
      : "";

    return `import { Server } from "balda";

const serverInstance = new Server({
  port: 80,
  host: "0.0.0.0",
  plugins: {
    bodyParser: {
      json: {
        sizeLimit: "100kb",
      }
    },
  }${graphqlConfig}
});

export { serverInstance as server };
`;
  }

  static getIndexTemplate() {
    const imports: string[] = ['import { server } from "./server.js";'];
    const services: string[] = [];

    if (this.mqtt) {
      imports.push('import "./mqtt/mqtt.config.js";');
      imports.push('import { MqttService } from "balda";');
      services.push(`
  // Initialize MQTT service
  await MqttService.connect({
    host: "localhost",
    port: 1883,
    protocol: "mqtt",
  });
  console.log("MQTT service connected");`);
    }

    if (this.cron) {
      imports.push('import "./cron/cron.config.js";');
      imports.push('import { CronService } from "balda";');
      services.push(`
  // Initialize Cron service
  await CronService.run();
  console.log("Cron service started");`);
    }

    if (this.graphql) {
      imports.push('import "./graphql/graphql.config.js";');
      services.push(`
  // GraphQL endpoint available at /graphql
  console.log("GraphQL service configured");`);
    }

    const importsBlock = imports.join("\n");
    const servicesBlock = services.length > 0 ? services.join("\n") : "";

    return `${importsBlock}
${servicesBlock ? `\n${servicesBlock}\n` : ""}
server.listen(({ url }) => {
  console.log(\`Server is running on \${url}\`);
});
`;
  }

  static getMqttConfigTemplate() {
    return `// MQTT Configuration
// This file is imported to set up MQTT connection options
// Add your MQTT handlers in separate files within this directory
// Use: npx balda generate-mqtt <handler-name> to create new handlers
`;
  }

  static getCronConfigTemplate() {
    return `// Cron Configuration
// This file is imported to set up Cron jobs
// Add your cron jobs in separate files within this directory
// Use: npx balda generate-cron <job-name> to create new cron jobs
`;
  }

  static getGraphqlConfigTemplate() {
    return `// GraphQL Configuration
// This file is imported to set up GraphQL schema and resolvers
// Add your GraphQL type definitions and resolvers in separate files within this directory
// The GraphQL endpoint is automatically available at /graphql
// You can extend the schema using server.graphql.addTypeDef() and server.graphql.addResolver()
`;
  }
}

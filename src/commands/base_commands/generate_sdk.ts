import { execSync } from "node:child_process";
import { arg } from "../../decorators/command/arg.js";
import { flag } from "../../decorators/command/flag.js";
import { execWithPrompt, getPackageManager } from "../../package.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { Server } from "../../server/server.js";
import { Command } from "../base_command.js";

export default class GenerateSdkCommand extends Command {
  static commandName = "generate-sdk";
  static description =
    "Generate a TypeScript SDK from your server's OpenAPI specification";
  static help = [
    "Generate a TypeScript SDK from your server's OpenAPI specification",
    "This command imports your server instance, starts it if needed, downloads the OpenAPI spec, and generates an SDK",
    "",
    "Arguments:",
    "  serverPath              Path to the server instance file (default: test/server/instance.ts)",
    "",
    "Flags:",
    "  -o, --output <path>     Output directory for generated SDK (default: sdk)",
    "  -s, --swagger-path <path>  Swagger UI path on your server (default: /docs)",
    "  -c, --client <type>     HTTP client to use: axios or fetch (default: fetch)",
    "  --unwrap-response-data  Automatically unwrap response data property",
    "  --single-http-client    Generate single HTTP client instance",
    "  --type-prefix <prefix>  Add prefix to all generated types",
    "  --type-suffix <suffix>  Add suffix to all generated types",
    "  --enum-names-as-values  Use enum names as values",
    "  --sort-types            Sort types alphabetically",
    "",
    "Examples:",
    "  npx balda generate-sdk",
    "  npx balda generate-sdk src/server/index.ts -o ./client-sdk",
    "  npx balda generate-sdk src/server.ts --client axios",
    "  npx balda generate-sdk --unwrap-response-data --single-http-client",
    "  npx balda generate-sdk --type-prefix Api --sort-types",
  ];

  @arg({
    description:
      "Path to the server instance file (should export a Server instance)",
    required: false,
    defaultValue: "test/server/instance.ts",
  })
  static serverPath: string;

  @flag({
    description: "Output directory for generated SDK",
    type: "string",
    aliases: ["o"],
    name: "output",
    required: false,
    defaultValue: "sdk",
  })
  static outputPath: string;

  @flag({
    description: "Swagger UI path on your server",
    type: "string",
    aliases: ["s"],
    name: "swagger-path",
    required: false,
  })
  static swaggerPath?: string;

  @flag({
    description: "HTTP client to use (axios or fetch)",
    type: "string",
    aliases: ["c"],
    name: "client",
    required: false,
    defaultValue: "fetch",
  })
  static httpClient: string;

  @flag({
    description: "Unwrap response data automatically",
    type: "boolean",
    name: "unwrap-response-data",
    required: false,
    defaultValue: false,
  })
  static unwrapResponseData: boolean;

  @flag({
    description: "Generate single HTTP client instance",
    type: "boolean",
    name: "single-http-client",
    required: false,
    defaultValue: false,
  })
  static singleHttpClient: boolean;

  @flag({
    description: "Add prefix to all generated types",
    type: "string",
    name: "type-prefix",
    required: false,
  })
  static typePrefix?: string;

  @flag({
    description: "Add suffix to all generated types",
    type: "string",
    name: "type-suffix",
    required: false,
  })
  static typeSuffix?: string;

  @flag({
    description: "Use enum names as values",
    type: "boolean",
    name: "enum-names-as-values",
    required: false,
    defaultValue: false,
  })
  static enumNamesAsValues: boolean;

  @flag({
    description: "Sort types alphabetically",
    type: "boolean",
    name: "sort-types",
    required: false,
    defaultValue: false,
  })
  static sortTypes: boolean;

  static async handle(): Promise<void> {
    console.log("\n🚀 Starting SDK generation...\n");

    // Step 1: Check if swagger-typescript-api is installed
    const sdkGenerator = "swagger-typescript-api";
    const nodeModulesPath = nativePath.join(process.cwd(), "node_modules");
    const hasNodeModules = await nativeFs.exists(nodeModulesPath);
    const generatorPath = nativePath.join(nodeModulesPath, sdkGenerator);
    const hasGenerator = hasNodeModules
      ? await nativeFs.exists(generatorPath)
      : false;

    if (!hasGenerator) {
      console.log(
        `📦 ${sdkGenerator} not found. Installing as dev dependency...\n`,
      );
      const [packageManager, packageCommand, devFlag] =
        await getPackageManager();

      const installed = await execWithPrompt(
        `${packageManager} ${packageCommand} ${sdkGenerator} ${devFlag}`,
        packageManager,
        [sdkGenerator],
        { stdio: "inherit" },
        true,
      );

      if (!installed) {
        console.log(
          "\x1b[33m⚠️  SDK generation cancelled: swagger-typescript-api installation was skipped.\x1b[0m\n",
        );
        return;
      }

      console.log(
        `\n\x1b[32m✅ ${sdkGenerator} installed successfully!\x1b[0m\n`,
      );
    }

    // Step 2: Import and start the server
    const absoluteServerPath = nativePath.resolve(
      process.cwd(),
      this.serverPath,
    );
    const serverPathExists = await nativeFs.exists(absoluteServerPath);

    if (!serverPathExists) {
      console.error(
        `\x1b[31m❌ Error: Server file not found at ${absoluteServerPath}\x1b[0m\n`,
      );
      return;
    }

    console.log(`📂 Loading server from: ${this.serverPath}`);

    let serverModule: Record<string, unknown>;
    try {
      // Import the server module
      const fileUrl = `file://${absoluteServerPath}`;
      serverModule = (await import(fileUrl)) as Record<string, unknown>;
    } catch (error) {
      console.error(`\x1b[31m❌ Error importing server module:\x1b[0m`, error);
      return;
    }

    const possibleExports = Object.keys(serverModule);

    // Find the Server instance in the module exports
    let serverInstance: Server | null = null;
    for (const exportName of possibleExports) {
      let currentModule = serverModule[exportName] as {
        default?: any;
        [key: string]: any;
      };

      if ("default" in currentModule && currentModule.default) {
        currentModule = currentModule.default;
      }

      if (
        currentModule &&
        "_brand" in currentModule &&
        currentModule._brand === "BaldaServer"
      ) {
        if (typeof currentModule === "object" && "listen" in currentModule) {
          serverInstance = currentModule as unknown as Server;
          console.log(`✅ Found server instance in export: "${exportName}"\n`);
          break;
        }
      }
    }

    if (!serverInstance) {
      console.error(
        `\x1b[31m❌ Error: No Server instance found in ${this.serverPath}\x1b[0m`,
      );
      console.log(
        `\x1b[90mExpected exports: ${possibleExports.join(", ")}\x1b[0m\n`,
      );
      return;
    }

    // Step 3: Start the server
    let wasStarted = false;
    let serverUrl = "";
    let serverPort = 80;
    let serverHost = "localhost";

    serverUrl = `http://${serverHost}:${serverPort}`;
    try {
      // Start the server
      console.log(`🌐 Starting server on ${serverUrl}...`);
      if (
        typeof serverInstance.listen === "function" &&
        !serverInstance.isListening
      ) {
        await new Promise<void>((res, rej) => {
          try {
            serverInstance.listen(() => {
              wasStarted = true;
              console.log(`✅ Server started successfully!\n`);
              res();
            });
          } catch (error) {
            rej(error);
          }
        }).catch((error) => {
          console.error(`Failed to start the server, continuing...`);
        });
      } else {
        throw new Error("Server instance does not have a listen() method");
      }
    } catch (error) {
      console.error(`\x1b[31m❌ Error starting server:\x1b[0m`, error);
      return;
    }

    // Step 4: Download OpenAPI spec
    const swaggerPath =
      this.swaggerPath ??
      (typeof serverInstance.serverOptions.swagger !== "boolean"
        ? serverInstance.serverOptions.swagger?.path
        : "/docs");
    const swaggerJsonUrl = nativePath.join(
      serverUrl,
      swaggerPath ?? "/docs",
      "/json",
    );

    console.log(`📥 Downloading OpenAPI spec from: ${swaggerJsonUrl}`);

    let openApiSpec: Record<string, unknown>;
    try {
      const response = await globalThis.fetch(swaggerJsonUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
        );
      }
      openApiSpec = (await response.json()) as Record<string, unknown>;
      console.log(`✅ OpenAPI spec downloaded successfully!\n`);
    } catch (error) {
      console.error(`\x1b[31m❌ Error downloading OpenAPI spec:\x1b[0m`, error);
      if (wasStarted) {
        const serverWithClose = serverInstance as Server & {
          close?: () => Promise<void>;
        };
        try {
          await serverWithClose.close?.();
        } catch {
          // Ignore close errors
        }
      }
      return;
    }

    // Step 5: Save OpenAPI spec to temp file
    const tempSpecPath = nativePath.join(process.cwd(), ".openapi-spec.json");
    try {
      await nativeFs.writeFile(
        tempSpecPath,
        new TextEncoder().encode(JSON.stringify(openApiSpec, null, 2)),
      );
    } catch (error) {
      console.error(
        `\x1b[31m❌ Error saving OpenAPI spec to file:\x1b[0m`,
        error,
      );
      if (wasStarted) {
        const serverWithClose = serverInstance as Server & {
          close?: () => Promise<void>;
        };
        try {
          await serverWithClose.close?.();
        } catch {
          // Ignore close errors
        }
      }
      return;
    }

    // Step 6: Generate SDK using swagger-typescript-api
    const outputDir = nativePath.resolve(process.cwd(), this.outputPath);
    console.log(`🔨 Generating SDK...\n`);

    try {
      // Create output directory if it doesn't exist
      if (!(await nativeFs.exists(outputDir))) {
        await nativeFs.mkdir(outputDir, { recursive: true });
      }

      // Build command with options
      const commandParts = [
        "npx swagger-typescript-api generate",
        `--path="${tempSpecPath}"`,
        `--output="${this.outputPath}"`,
        `--http-client ${this.httpClient}`,
        "--modular",
        "--extract-request-params",
        "--extract-request-body",
        "--extract-response-body",
        "--extract-response-error",
      ];

      // Add optional flags
      if (this.unwrapResponseData) {
        commandParts.push("--unwrap-response-data");
      }

      if (this.singleHttpClient) {
        commandParts.push("--single-http-client");
      }

      if (this.typePrefix) {
        commandParts.push(`--type-prefix "${this.typePrefix}"`);
      }

      if (this.typeSuffix) {
        commandParts.push(`--type-suffix "${this.typeSuffix}"`);
      }

      if (this.enumNamesAsValues) {
        commandParts.push("--enum-names-as-values");
      }

      if (this.sortTypes) {
        commandParts.push("--sort-types");
      }

      const command = commandParts.join(" ");

      execSync(command, {
        stdio: "inherit",
        cwd: process.cwd(),
      });

      console.log(`\n\x1b[32m✅ SDK generated successfully!\x1b[0m`);
      console.log(`\x1b[32m📁 SDK location: ${outputDir}\x1b[0m\n`);
    } catch (error) {
      console.error(`\x1b[31m❌ Error generating SDK:\x1b[0m`, error);
    } finally {
      // Cleanup: Remove temp spec file
      try {
        await nativeFs.unlink(tempSpecPath);
      } catch {
        // Ignore cleanup errors
      }

      // Cleanup: Stop server if we started it
      if (wasStarted) {
        const serverWithClose = serverInstance as Server & {
          close?: () => Promise<void>;
        };
        try {
          console.log("🛑 Stopping server...");
          await serverWithClose.close?.();
          console.log("✅ Server stopped.\n");
        } catch {
          console.log("\x1b[33m⚠️  Could not stop server gracefully.\x1b[0m\n");
        }
      }
    }

    console.log("\x1b[32m✨ SDK generation complete!\x1b[0m\n");
  }
}

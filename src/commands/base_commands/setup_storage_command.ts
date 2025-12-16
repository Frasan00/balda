import { flag } from "../../decorators/command/flag.js";
import { execWithPrompt, getPackageManager } from "../../package.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { Command } from "../base_command.js";

export default class SetupStorageCommand extends Command {
  static commandName = "setup-storage";
  static description = "Setup storage provider with required dependencies";
  static help = [
    "Install dependencies and create storage configuration for a specific provider",
    "Flags:",
    "  -t, --type <provider>    Storage provider type (s3, azure, local)",
    "  -o, --output <path>      Output directory for storage setup (default: src/storage/)",
    "",
    "Examples:",
    "  npx balda setup:storage -t s3",
    "  npx balda setup:storage --type azure --output src/config/",
  ];

  @flag({
    description: "Storage provider type (s3, azure, local)",
    type: "string",
    aliases: ["t"],
    name: "type",
    required: true,
  })
  static storageType: string;

  @flag({
    description: "Output directory for storage setup",
    type: "string",
    aliases: ["o"],
    name: "output",
    required: false,
    defaultValue: "src/storage/",
  })
  static outputPath: string;

  static async handle(): Promise<void> {
    if (!this.storageType) {
      console.error(
        "\x1b[31m❌ Error: Storage type is required. Use -t or --type flag.\x1b[0m",
      );
      console.log("\x1b[90mExample: npx balda setup:storage -t s3\x1b[0m\n");
      return;
    }

    if (!this.outputPath) {
      await nativeFs.mkdir(nativePath.join(process.cwd(), this.outputPath), {
        recursive: true,
      });
    }

    const validTypes = ["s3", "azure", "local"];
    if (!validTypes.includes(this.storageType)) {
      console.error(
        `\x1b[31m❌ Error: Invalid storage type '${this.storageType}'. Valid types: ${validTypes.join(", ")}\x1b[0m\n`,
      );
      return;
    }

    console.log(
      `\n🚀 Setting up ${this.storageType.toUpperCase()} storage provider...\n`,
    );

    const dependencies = this.getDependencies(this.storageType);

    if (dependencies.length === 0) {
      console.log(
        `\x1b[32m✅ ${this.storageType.toUpperCase()} storage doesn't require additional dependencies.\x1b[0m\n`,
      );
    }

    if (dependencies.length) {
      const missingDeps = await this.checkMissingDependencies(dependencies);

      if (missingDeps.length === 0) {
        console.log(
          `\x1b[32m✅ All required dependencies are already installed.\x1b[0m\n`,
        );
      }

      if (missingDeps.length) {
        const [packageManager, installCommand] = await getPackageManager();
        const command = `${packageManager} ${installCommand} ${missingDeps.join(" ")}`;

        const installed = await execWithPrompt(
          command,
          packageManager,
          missingDeps,
          { stdio: "inherit" },
          false,
        );

        if (!installed) {
          console.log(
            "\x1b[33m⚠️  Dependency installation skipped by user.\x1b[0m\n",
          );
          return;
        }

        console.log(
          `\n\x1b[32m✅ Dependencies installed successfully!\x1b[0m\n`,
        );
      }
    }

    await this.createStorageSetup(this.storageType, this.outputPath);

    console.log(
      `\x1b[32m✨ ${this.storageType.toUpperCase()} storage setup complete!\x1b[0m\n`,
    );
  }

  private static getDependencies(storageType: string): string[] {
    const dependencyMap: Record<string, string[]> = {
      s3: [
        "@aws-sdk/client-s3",
        "@aws-sdk/s3-request-presigner",
        "@aws-sdk/cloudfront-signer",
      ],
      azure: ["@azure/storage-blob"],
      local: [],
    };

    return dependencyMap[storageType] || [];
  }

  private static async checkMissingDependencies(
    dependencies: string[],
  ): Promise<string[]> {
    const packageJsonPath = nativePath.join(process.cwd(), "package.json");
    const exists = await nativeFs.exists(packageJsonPath);
    if (!exists) {
      return dependencies;
    }

    const nodeModulesPath = nativePath.join(process.cwd(), "node_modules");
    const nodeModulesExists = await nativeFs.exists(nodeModulesPath);
    if (!nodeModulesExists) {
      return dependencies;
    }

    const missing: string[] = [];
    for (const dep of dependencies) {
      const depPath = nativePath.join(nodeModulesPath, dep);
      const depExists = await nativeFs.exists(depPath);
      if (!depExists) {
        missing.push(dep);
      }
    }

    return missing;
  }

  private static async createStorageSetup(
    storageType: string,
    outputPath: string,
  ): Promise<void> {
    const resolvedPath = nativePath.join(process.cwd(), outputPath);
    const exists = await nativeFs.exists(resolvedPath);

    if (!exists) {
      await nativeFs.mkdir(resolvedPath, { recursive: true });
    }

    const configFile = nativePath.join(
      resolvedPath,
      `${storageType}.config.ts`,
    );
    const configExists = await nativeFs.exists(configFile);

    if (configExists) {
      console.log(
        `\x1b[33m⚠️  Configuration file already exists: ${configFile}\x1b[0m`,
      );
      return;
    }

    const template = this.getConfigTemplate(storageType);
    await nativeFs.writeFile(configFile, new TextEncoder().encode(template));

    console.log(`\x1b[32m✅ Created configuration file: ${configFile}\x1b[0m`);
  }

  private static getConfigTemplate(storageType: string): string {
    const templates: Record<string, string> = {
      s3: `import { S3StorageProvider } from "balda-js";

/**
 * S3 Storage Configuration
 *
 * Environment variables required:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION
 * - S3_BUCKET
 *
 * Optional for CloudFront:
 * - CLOUDFRONT_DOMAIN
 * - CLOUDFRONT_KEY_PAIR_ID
 * - CLOUDFRONT_PRIVATE_KEY
 */

export const s3Provider = new S3StorageProvider({
  s3ClientConfig: {
    bucketName: process.env.S3_BUCKET || "your-bucket-name",
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  },
  // Uncomment to enable CloudFront signed URLs
  // cloudfrontOptions: {
  //   domainName: process.env.CLOUDFRONT_DOMAIN || "",
  //   keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID || "",
  //   privateKey: process.env.CLOUDFRONT_PRIVATE_KEY || "",
  // },
});
`,
      azure: `import { AzureBlobStorageProvider } from "balda-js";

/**
 * Azure Blob Storage Configuration
 *
 * Environment variables required:
 * - AZURE_STORAGE_CONNECTION_STRING
 * - AZURE_CONTAINER_NAME
 * - AZURE_STORAGE_ACCOUNT
 * - AZURE_STORAGE_KEY
 */

export const azureProvider = new AzureBlobStorageProvider({
  containerName: process.env.AZURE_CONTAINER_NAME || "your-container-name",
  connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || "",
  storageAccountName: process.env.AZURE_STORAGE_ACCOUNT || "",
  storageAccountKey: process.env.AZURE_STORAGE_KEY || "",
});
`,
      local: `import { LocalStorageProvider } from "balda-js";

/**
 * Local Storage Configuration
 *
 * Environment variables required:
 * - LOCAL_STORAGE_DIR (default: ./storage)
 *
 * Optional for signed URLs:
 * - LOCAL_STORAGE_BASE_URL
 * - LOCAL_STORAGE_SECRET_KEY
 */

export const localProvider = new LocalStorageProvider({
  directory: "./uploads",
});
`,
    };

    return templates[storageType] || "";
  }
}

import { flag } from "../../decorators/command/flag.js";
import {
  execWithPrompt,
  getPackageManager,
  getUninstalledPackages,
} from "../../package.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { Command } from "../base_command.js";

export default class InitMailerCommand extends Command {
  static commandName = "init-mailer";
  static description =
    "Initialize mailer configuration with required dependencies";
  static help = [
    "Initialize a mailer configuration file with basic setup",
    "Automatically installs required packages for nodemailer and optional template engines",
    "Supports Handlebars, EJS, Edge.js, Mustache, or custom adapters",
    "Example: npx balda init-mailer -t handlebars -o src/mailer",
  ];

  @flag.string({
    description:
      "Template engine (handlebars, ejs, edge, mustache, custom, none) - optional",
    aliases: "t",
    name: "template",
    required: false,
    defaultValue: "none",
  })
  static templateEngine:
    | "handlebars"
    | "ejs"
    | "edge"
    | "mustache"
    | "custom"
    | "none";

  @flag.string({
    description:
      "Output directory for mailer configuration, default is src/mailer",
    aliases: "o",
    name: "output",
    required: false,
    defaultValue: "src/mailer",
  })
  static outputPath: string;

  static mailerDependencies: Record<string, string[]> = {
    base: ["nodemailer", "@types/nodemailer"],
    handlebars: ["handlebars", "@types/handlebars"],
    ejs: ["ejs", "@types/ejs"],
    edge: ["edge.js"],
    mustache: ["mustache", "@types/mustache"],
  };

  static async handle(): Promise<void> {
    this.logger.info("Initializing mailer configuration...");

    if (
      !["handlebars", "ejs", "edge", "mustache", "custom", "none"].includes(
        this.templateEngine,
      )
    ) {
      this.logger.error(
        `Invalid template engine: ${this.templateEngine}. Must be one of: handlebars, ejs, edge, mustache, custom, none`,
      );
      return;
    }

    const [packageManager, packageManagerCommand] = await getPackageManager();

    // Install dependencies if on npm, yarn, or pnpm
    if (["npm", "yarn", "pnpm"].includes(packageManager)) {
      const dependencies = [
        ...this.mailerDependencies.base,
        ...(this.templateEngine !== "none" && this.templateEngine !== "custom"
          ? this.mailerDependencies[this.templateEngine] || []
          : []),
      ];

      const uninstalledDeps = await getUninstalledPackages(dependencies);

      if (uninstalledDeps.length > 0) {
        this.logger.info(
          `Found ${uninstalledDeps.length} missing dependencies for mailer`,
        );
        const installed = await execWithPrompt(
          `${packageManager} ${packageManagerCommand} ${uninstalledDeps.join(" ")}`,
          packageManager,
          uninstalledDeps,
          {
            stdio: "inherit",
          },
          false,
        );

        if (!installed) {
          this.logger.info(
            "Installation cancelled by user. Mailer initialization aborted.",
          );
          return;
        }
      }

      if (uninstalledDeps.length === 0) {
        this.logger.info("All mailer dependencies are already installed");
      }
    }

    const configTemplate = this.getConfigTemplate();
    const fileName = "mailer.config.ts";
    const fullPath = nativePath.join(this.outputPath, fileName);

    if (!(await nativeFs.exists(this.outputPath))) {
      await nativeFs.mkdir(this.outputPath, { recursive: true });
    }

    this.logger.info(`Creating ${fileName} file at ${this.outputPath}...`);
    await nativeFs.writeFile(
      fullPath,
      new TextEncoder().encode(configTemplate),
    );

    this.logger.info(
      `Mailer configuration initialized successfully at ${fullPath}`,
    );
    this.logger.info(
      "Remember to update the configuration with your actual SMTP credentials",
    );

    if (this.templateEngine !== "none") {
      this.logger.info(
        `Template engine '${this.templateEngine}' configured and ready to use`,
      );
    }
  }

  static getConfigTemplate(): string {
    const hasTemplate = this.templateEngine !== "none";

    return `import { createTransport } from "nodemailer";
import { Mailer${hasTemplate ? `, ${this.getAdapterImport()}` : ""} } from "balda";

/**
 * Configure your email transporter
 * For development, you can use MailCatcher (docker-compose up mailcatcher)
 * For production, use your SMTP service (Gmail, SendGrid, AWS SES, etc.)
 */
const transporter = createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025", 10),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
  auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    : undefined,
});
${this.getTemplateAdapterSetup()}
/**
 * Initialize the Mailer with multiple providers (optional)
 * You can define different providers for different purposes
 */
export const mailer = new Mailer(
  {
    default: {
      transporter,${hasTemplate ? "\n      templateAdapter: adapter," : ""}
      from: process.env.DEFAULT_FROM_EMAIL || "noreply@example.com",
    },
    // Add more providers as needed
    // transactional: { transporter: transactionalTransporter, from: "..." },
    // marketing: { transporter: marketingTransporter, from: "..." },
  },
  {
    defaultProvider: "default",
  }
);

/**
 * Example usage:
 *
 * // Send a simple email
 * await mailer.send({
 *   to: "user@example.com",
 *   subject: "Welcome!",
 *   text: "Hello from Balda!",
 *   html: "<h1>Hello from Balda!</h1>",
 * });
${this.getTemplateExample()}
 * // Use a different provider
 * await mailer.use("transactional").send({
 *   to: "user@example.com",
 *   subject: "Transaction Complete",
 *   text: "Your order has been processed",
 * });
 *
 * // Verify connection
 * const isValid = await mailer.verify();
 * console.log("Mail provider connection:", isValid ? "OK" : "Failed");
 */
`;
  }

  static getAdapterImport(): string {
    const adapterMap: Record<string, string> = {
      handlebars: "HandlebarsAdapter",
      ejs: "EjsAdapter",
      edge: "EdgeAdapter",
      mustache: "MustacheAdapter",
      custom: "CustomAdapter",
    };

    return adapterMap[this.templateEngine] || "";
  }

  static getTemplateAdapterSetup(): string {
    if (this.templateEngine === "none") {
      return "";
    }

    if (this.templateEngine === "handlebars") {
      return `
/**
 * Configure Handlebars template adapter
 * Supports helpers, partials, and custom compilation options
 */
const adapter = new HandlebarsAdapter();

// Register custom helpers (optional)
// await adapter.registerHelper("uppercase", (str: string) => str.toUpperCase());

// Register partials (optional)
// await adapter.registerPartial("header", "<header>{{title}}</header>");
`;
    }

    if (this.templateEngine === "ejs") {
      return `
/**
 * Configure EJS template adapter
 * Pass custom options to the EJS compiler
 */
const adapter = new EjsAdapter({
  // Custom EJS options (optional)
  // cache: true,
  // delimiter: "%",
});
`;
    }

    if (this.templateEngine === "edge") {
      return `
/**
 * Configure Edge.js template adapter
 * Supports global helpers and custom tags
 */
const adapter = new EdgeAdapter();

// Register globals (optional)
// await adapter.global("appName", "My App");

// Register custom tags (optional)
// await adapter.registerTag(myCustomTag);
`;
    }

    if (this.templateEngine === "mustache") {
      return `
/**
 * Configure Mustache template adapter
 * Supports partials for template composition
 */
const adapter = new MustacheAdapter();

// Register partials (optional)
// adapter.registerPartial("header", "<header>{{title}}</header>");
`;
    }

    if (this.templateEngine === "custom") {
      return `
/**
 * Configure Custom template adapter
 * Simple {{variable}} interpolation with helper support
 */
const adapter = new CustomAdapter();

// Register custom helpers (optional)
// adapter.registerHelper("uppercase", (value: unknown) =>
//   String(value).toUpperCase()
// );
`;
    }

    return "";
  }

  static getTemplateExample(): string {
    if (this.templateEngine === "none") {
      return "";
    }

    return `
 * // Send email with template
 * await mailer.sendWithTemplate({
 *   to: "user@example.com",
 *   subject: "Welcome {{name}}!",
 *   template: "<h1>Hello {{name}}</h1><p>Welcome to {{appName}}!</p>",
 *   data: {
 *     name: "John Doe",
 *     appName: "My App",
 *   },
 * });
 *`;
  }
}

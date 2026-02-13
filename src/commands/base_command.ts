import { VALIDATION_ERROR_SYMBOL } from "../decorators/command/arg.js";
import { logger } from "../logger/logger.js";
import { MetadataStore } from "../metadata_store.js";
import { nativeExit } from "../runtime/native_exit.js";
import {
  Argument,
  type FlagSchema,
  parseCliArgsAndFlags,
} from "./arg_parser.js";
import type { CommandFlagsAndArgs, CommandOptions } from "./command_types.js";

/**
 * Base class for all cli commands.
 * @abstract
 */
export abstract class Command {
  private static readonly flagsAndArgs: CommandFlagsAndArgs = {
    flags: parseCliArgsAndFlags().flags,
    args: parseCliArgsAndFlags().args.slice(1),
  };

  /**
   * The name of the command.
   */
  static commandName: string = this.name;
  /**
   * package manager that called the command (e.g. npx, yarn, bun etc.)
   */
  static calledBy: string = this.name;
  /**
   * The description of the command.
   */
  static description: string = "";
  /**
   * The help text of the command.
   */
  static help: string[] | string = [];
  /**
   * The options of the command.
   */
  static options: CommandOptions = {
    keepAlive: false,
    loggerPath: "src/logger.ts",
    allowUnknownFlags: true,
  };

  /**
   * Static arguments in order to be validated by decorators. Will be fetched in the command instance.
   */
  static args: Argument[] = this.flagsAndArgs.args;

  /**
   * Static flags in order to be validated by decorators. Will be fetched in the command instance.
   */
  static flags: FlagSchema = this.flagsAndArgs.flags;

  static logger = logger.child({ scope: this.constructor.name });

  /**
   * Main entry point for the command.
   */
  static handle(): Promise<void> {
    throw new Error(
      `Handle method not implemented in command class ${this.name}`,
    );
  }

  /**
   * Enhanced help flag handler with rich formatting and command information
   */
  static handleHelpFlag(flags: FlagSchema): void {
    const helpFlags = ["-h", "--help"];
    const hasHelpFlag = Object.keys(flags).some((flag) =>
      helpFlags.includes(flag),
    );

    if (!hasHelpFlag) {
      return;
    }

    const commandName = this.commandName;
    const description = this.description || "No description available";
    const helpText = this.help || [];
    const options = this.options;

    const helpOutput = this.generateHelpOutput(
      {
        name: commandName,
        description,
        helpText,
        options,
        args: this.args,
        flags: this.flags,
      },
      this,
    );

    console.log(helpOutput);
    nativeExit.exit(0);
  }

  private static readonly generateHelpOutput = (
    info: {
      name: string;
      description: string;
      helpText: string[] | string;
      options: CommandOptions;
      args: Argument[];
      flags: FlagSchema;
    },
    commandClass: any,
  ): string => {
    const { name, description, helpText, options, args, flags } = info;

    const colors = {
      title: "\x1b[1;36m", // Bright cyan
      subtitle: "\x1b[1;33m", // Bright yellow
      description: "\x1b[0;37m", // White
      code: "\x1b[0;32m", // Green
      flag: "\x1b[0;35m", // Magenta
      reset: "\x1b[0m", // Reset
      error: "\x1b[0;31m", // Red
      success: "\x1b[0;32m", // Green
      info: "\x1b[0;34m", // Blue
    };

    const lines = [
      `${colors.title}${name}${colors.reset}`,
      `${colors.description}${description}${colors.reset}`,
      "",
      `${colors.subtitle}Usage:${colors.reset}`,
      `  ${colors.code}${name}${colors.reset} [options] [arguments]`,
      "",
      `${colors.subtitle}Options:${colors.reset}`,
      `  ${colors.flag}-h, --help${colors.reset}     Show this help message`,
      "",
      `${colors.subtitle}Command Options:${colors.reset}`,
      `  ${colors.flag}keepAlive${colors.reset}      ${(options?.keepAlive ?? false) ? colors.success + "Enabled" + colors.reset : colors.error + "Disabled" + colors.reset}`,
      `  ${colors.flag}loggerPath${colors.reset}     ${options?.loggerPath ?? "src/logger.ts"}`,
      `  ${colors.flag}allowUnknownFlags${colors.reset} ${(options?.allowUnknownFlags ?? true) ? colors.success + "Enabled" + colors.reset : colors.error + "Disabled" + colors.reset}`,
      "",
    ];

    if (helpText) {
      const helpLines = Array.isArray(helpText) ? helpText : [helpText];
      lines.push(`${colors.subtitle}Help:${colors.reset}`);
      helpLines.forEach((line) => {
        lines.push(`  ${colors.description}${line}${colors.reset}`);
      });
      lines.push("");
    }

    // Always show available arguments and flags from decorators
    const allMeta = MetadataStore.getAll(commandClass);
    const argsMeta = allMeta
      ? Array.from(allMeta.values()).filter((meta) => meta.type === "arg")
      : [];
    const flagsMeta = allMeta
      ? Array.from(allMeta.values()).filter((meta) => meta.type === "flag")
      : [];

    if (argsMeta.length) {
      lines.push(`${colors.subtitle}Available Arguments:${colors.reset}`);
      argsMeta.forEach((meta) => {
        const required = meta.required
          ? ` ${colors.error}(required)${colors.reset}`
          : "";
        const description = meta.description
          ? ` ${colors.description}${meta.description}${colors.reset}`
          : "";
        lines.push(
          `  ${colors.code}${meta.name}${colors.reset}${required}${description}`,
        );
      });
      lines.push("");
    }

    if (flagsMeta.length) {
      lines.push(`${colors.subtitle}Available Flags:${colors.reset}`);
      flagsMeta.forEach((meta) => {
        if (meta.aliases && !Array.isArray(meta.aliases)) {
          meta.aliases = [meta.aliases];
        }

        const aliases = meta.aliases.length
          ? ` ${colors.flag}(${meta.aliases.join(", ")})${colors.reset}`
          : "";
        const required = meta.required
          ? ` ${colors.error}(required)${colors.reset}`
          : "";
        const description = meta.description
          ? ` ${colors.description}${meta.description}${colors.reset}`
          : "";
        lines.push(
          `  ${colors.flag}--${meta.name}${aliases}${colors.reset}${required}${description}`,
        );
      });
      lines.push("");
    }

    // Show current context if arguments or flags were provided
    if ((args?.length ?? 0) > 0 || (flags && Object.keys(flags).length > 0)) {
      lines.push(`${colors.subtitle}Current Context:${colors.reset}`);

      if (args?.length) {
        lines.push(
          `  ${colors.info}Provided Arguments:${colors.reset} ${colors.code}${args.join(" ")}${colors.reset}`,
        );
      }

      if (flags && Object.keys(flags).length > 0) {
        lines.push(`  ${colors.info}Provided Flags:${colors.reset}`);
        Object.keys(flags).forEach((flagKey) => {
          const flagValue = flags[flagKey];
          const valueDisplay =
            flagValue !== undefined && flagValue !== null
              ? ` = ${colors.code}${flagValue}${colors.reset}`
              : "";
          lines.push(
            `  ${colors.flag}${flagKey}${colors.reset}${valueDisplay}`,
          );
        });
      }
      lines.push("");
    }

    if (
      helpText &&
      (Array.isArray(helpText)
        ? helpText.some((line) => line.includes("example"))
        : helpText.includes("example"))
    ) {
      lines.push(`${colors.subtitle}Examples:${colors.reset}`);
      const examples = Array.isArray(helpText)
        ? helpText.filter((line) => line.includes("example"))
        : [helpText.split("example")[1].trim()];
      examples.forEach((example) => {
        lines.push(`  ${colors.code}${example}${colors.reset}`);
      });
      lines.push("");
    }

    return lines.join("\n");
  };

  /**
   * Validates that no unknown flags were provided when allowUnknownFlags is false.
   */
  static readonly validateUnknownFlags = (target: any): void => {
    if (target.options?.allowUnknownFlags !== false) {
      return;
    }

    const alwaysAllowed = new Set(["-h", "--help"]);
    const knownFlags = new Set<string>();

    const allMeta = MetadataStore.getAll(target);
    if (allMeta) {
      for (const meta of allMeta.values()) {
        if (meta.type === "flag") {
          knownFlags.add(`--${meta.name}`);
          knownFlags.add(`-${meta.name}`);
          knownFlags.add(meta.name);
          if (meta.aliases) {
            const aliases = Array.isArray(meta.aliases)
              ? meta.aliases
              : [meta.aliases];
            for (const alias of aliases) {
              knownFlags.add(`--${alias}`);
              knownFlags.add(`-${alias}`);
              knownFlags.add(alias);
            }
          }
        }
      }
    }

    const unknownFlags = Object.keys(target.flags).filter(
      (flag) => !alwaysAllowed.has(flag) && !knownFlags.has(flag),
    );

    if (unknownFlags.length) {
      const colors = {
        error: "\x1b[0;31m",
        title: "\x1b[1;31m",
        reset: "\x1b[0m",
        info: "\x1b[0;34m",
        flag: "\x1b[0;35m",
      };

      console.error(`${colors.title}❌ Unknown Flags:${colors.reset}`);
      console.error("");
      unknownFlags.forEach((flag) => {
        console.error(
          `  ${colors.error}•${colors.reset} ${colors.flag}${flag}${colors.reset}`,
        );
      });
      console.error("");
      console.error(
        `${colors.info}💡 Tip: Use --help for available flags${colors.reset}`,
      );
      nativeExit.exit(1);
    }
  };

  static readonly validateContext = (target: any): void => {
    const errorChain = Array.from(
      MetadataStore.get(target, VALIDATION_ERROR_SYMBOL) || [],
    ) as Array<{ type: string; name: string; message: string }>;

    if (errorChain.length) {
      const colors = {
        error: "\x1b[0;31m", // Red
        title: "\x1b[1;31m", // Bright red
        reset: "\x1b[0m", // Reset
        info: "\x1b[0;34m", // Blue
        code: "\x1b[0;32m", // Green
      };

      console.error(`${colors.title}❌ Validation Errors:${colors.reset}`);
      console.error("");

      errorChain.forEach((error, index) => {
        const errorNumber = `${colors.info}${index + 1}.${colors.reset}`;
        const errorType = `${colors.error}${error.type.toUpperCase()}${colors.reset}`;
        const errorName = `${colors.code}${error.name}${colors.reset}`;

        console.error(
          `  ${errorNumber} ${errorType} ${errorName}: ${colors.error}${error.message}${colors.reset}`,
        );
      });

      console.error("");
      console.error(
        `${colors.info}💡 Tip: Use --help for usage information${colors.reset}`,
      );
      nativeExit.exit(1);
    }
  };
}

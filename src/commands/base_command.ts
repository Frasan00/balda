import { createLogger } from "src/logger/logger";
import { nativeExit } from "src/runtime/native_exit";
import { type FlagSchema, parseCliArgsAndFlags, Argument } from "./arg_parser";
import type { CommandOptions } from "./command_types";

/**
 * Base class for all cli commands.
 * @abstract
 */
export abstract class Command {
  /**
   * The name of the command.
   */
  static name: string = this.constructor.name;
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
  };

  /**
   * Static arguments in order to be validated by decorators. Will be fetched in the command instance.
   */
  static args: Argument[] = parseCliArgsAndFlags().args.slice(1);

  /**
   * Static flags in order to be validated by decorators. Will be fetched in the command instance.
   */
  static flags: FlagSchema = parseCliArgsAndFlags().flags;

  static readonly logger = createLogger();

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
  static readonly handleHelpFlag = (flags: FlagSchema) => {
    const helpFlags = ["-h", "--help", "-?", "--usage"];
    const hasHelpFlag = Object.keys(flags).some((flag) =>
      helpFlags.includes(flag),
    );

    if (!hasHelpFlag) {
      return;
    }

    const commandClass = this.constructor as typeof Command;
    const commandName = commandClass.name;
    const description = commandClass.description || "No description available";
    const helpText = commandClass.help || [];
    const options = commandClass.options;

    const helpOutput = this.generateHelpOutput({
      name: commandName,
      description,
      helpText,
      options,
      args: commandClass.args,
      flags: commandClass.flags,
    });

    console.log(helpOutput);
    nativeExit.exit(0);
  };

  private static readonly generateHelpOutput = (info: {
    name: string;
    description: string;
    helpText: string[] | string;
    options: CommandOptions;
    args: Argument[];
    flags: FlagSchema;
  }): string => {
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
      `  ${colors.flag}-?, --usage${colors.reset}    Show usage information`,
      "",
      `${colors.subtitle}Command Options:${colors.reset}`,
      `  ${colors.flag}keepAlive${colors.reset}      ${options.keepAlive ? colors.success + "Enabled" + colors.reset : colors.error + "Disabled" + colors.reset}`,
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

    if (args.length > 0 || Object.keys(flags).length > 0) {
      lines.push(`${colors.subtitle}Current Context:${colors.reset}`);

      if (args.length > 0) {
        lines.push(
          `  ${colors.info}Arguments:${colors.reset} ${colors.code}${args.join(" ")}${colors.reset}`,
        );
      }

      const currentFlags = Object.entries(flags)
        .filter(([key]) => !["-h", "--help", "-?", "--usage"].includes(key))
        .map(
          ([key, value]) =>
            `${colors.flag}${key}${colors.reset}=${colors.code}${value}${colors.reset}`,
        );

      if (currentFlags.length > 0) {
        lines.push(
          `  ${colors.info}Flags:${colors.reset} ${currentFlags.join(" ")}`,
        );
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
      lines.push(
        `  ${colors.code}${name} --help${colors.reset}     Show this help`,
      );
      lines.push(
        `  ${colors.code}${name} -v${colors.reset}         Show version (if supported)`,
      );
      lines.push("");
    }

    lines.push(
      `${colors.info}For more information, visit the documentation${colors.reset}`,
    );

    return lines.join("\n");
  };
}

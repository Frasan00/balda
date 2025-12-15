import { Command } from "../../src/commands/base_command.js";
import { arg } from "../../src/decorators/command/arg.js";
import { flag } from "../../src/decorators/command/flag.js";

export default class TestCommand extends Command {
  static name = "test";
  static description = "Test command";
  static help = "Test command";
  static options = {
    keepAlive: false,
  };

  @flag({
    type: "boolean",
    aliases: ["n"],
    name: "name",
    required: true,
    parse: (value) => value.toUpperCase(),
  })
  static test: boolean;

  @arg({
    required: true,
    parse: (value) => value.toUpperCase(),
  })
  static test2: string;

  @arg({
    required: true,
    parse: (value) => value.toUpperCase(),
  })
  static test3: string;

  static async handle() {
    console.log("Test command");
    console.log(this.args);
    console.log(this.flags);
    console.log(this.test);
    console.log(this.test2);
    console.log(this.test3);
  }
}

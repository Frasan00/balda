import { CommandRegistry } from "../../src/commands/command_registry.js";

CommandRegistry.setCommandsPattern("./test/commands/**/*.ts");

(async () => {
  await import("../../src/cli.js");
})();

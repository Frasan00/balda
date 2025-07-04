import { CommandRegistry } from "src/commands/command_registry";

CommandRegistry.setCommandsPattern("./test/commands/**/*.ts");

(async () => {
  await import("../../src/cli");
})();

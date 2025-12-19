import { flag } from "../../decorators/command/flag.js";
import { nativeFs } from "../../runtime/native_fs.js";
import { nativePath } from "../../runtime/native_path.js";
import { toLowerSnakeCase } from "../../utils.js";
import { Command } from "../base_command.js";

export default class GenerateMqttCommand extends Command {
  static commandName = "generate-mqtt";
  static description = "Generate a new MQTT handler in the specified path";
  static help = [
    "Generate a new MQTT handler in the specified path",
    "Example: npx balda generate-mqtt temperature-handler -p src/mqtt",
  ];

  @flag({
    description:
      "The path to the MQTT handler to generate, default is src/mqtt",
    type: "string",
    aliases: "p",
    name: "path",
    required: false,
    defaultValue: "src/mqtt",
  })
  static path: string;

  @flag({
    description: "The MQTT topic to subscribe to",
    type: "string",
    aliases: "t",
    name: "topic",
    required: false,
    defaultValue: "example/topic",
  })
  static topic: string;

  static async handle(): Promise<void> {
    const isValidLiteral = this.topic.match(/^[a-zA-Z_][a-zA-Z0-9_/]*$/);
    const mqttTemplate = this.getMqttTemplate(!!isValidLiteral);
    this.path = nativePath.join(
      this.path,
      `${toLowerSnakeCase(this.topic.replace("/", "-"))}.ts`,
    );

    if (!(await nativeFs.exists(nativePath.join(process.cwd(), this.path)))) {
      await nativeFs.mkdir(
        nativePath.join(
          process.cwd(),
          this.path.split("/").slice(0, -1).join("/"),
        ),
        { recursive: true },
      );
    }

    await nativeFs.writeFile(this.path, new TextEncoder().encode(mqttTemplate));

    this.logger.info(
      `MQTT handler for topic ${this.topic} created successfully at ${this.path}`,
    );
  }

  static getMqttTemplate(isValidLiteral: boolean) {
    return `import { BaseMqtt, mqtt } from "balda-js";

/**
 * Define your MQTT topics interface for type safety
 */
declare module "balda-js" {
  interface MqttTopics {
    ${isValidLiteral ? `${this.topic}: string;` : `'${this.topic}': string;`}
  }
}

export default class extends BaseMqtt {
  @mqtt.subscribe("${this.topic}")
  async handle(message: string) {
    this.logger.info({ message }, "Message received");
    // Implement your MQTT handler logic here
  }
}`;
  }
}

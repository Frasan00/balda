import { BaseMqtt } from "../../../src/mqtt/base_mqtt.js";
import { mqtt } from "../../../src/mqtt/mqtt.js";

declare module "../../../src/mqtt/mqtt.types.js" {
  interface MqttTopics {
    "test/example": string;
  }
}

export class ExampleHandler extends BaseMqtt {
  @mqtt.subscribe("test/example")
  async handleExample(message: string) {
    this.logger.info(`Example handler received: ${message}`);
  }
}

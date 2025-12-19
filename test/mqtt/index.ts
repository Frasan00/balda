import { BaseMqtt } from "../../src/mqtt/base_mqtt.js";
import { mqtt, MqttService } from "../../src/mqtt/mqtt.js";

/**
 * Define your MQTT topics interface for type safety
 * Extend the MqttTopics interface to add your custom topics
 */
declare module "../../src/mqtt/mqtt.types.js" {
  interface MqttTopics {
    "home/temperature": { value: number; unit: string };
    "home/humidity": { value: number };
    "home/ack": { received: boolean; timestamp: number };
    "sensors/data": string;
  }
}

/**
 * Example MQTT subscribe class
 * Demonstrates how to subscribe to MQTT topics using the @mqtt decorator
 * Messages are automatically parsed from Buffer:
 * - If valid JSON object -> returns parsed object
 * - Otherwise -> returns string
 */
class TemperatureHandler extends BaseMqtt {
  /**
   * Subscribe to a specific topic with typed payload
   * Message is automatically parsed from Buffer to JSON object
   * Topic parameter omitted since it's already known from decorator
   */
  @mqtt.subscribe("home/temperature", { qos: 1 })
  async handleTemperature(message: { value: number; unit: string }) {
    this.logger.info(`Received temperature: ${message.value}${message.unit}`);

    // Publish acknowledgment using singleton instance
    await mqtt.publish(
      "home/ack",
      { received: true, timestamp: Date.now() },
      { qos: 1 },
    );
  }

  /**
   * Subscribe to humidity with typed payload
   * Message is automatically parsed from Buffer to JSON object
   */
  @mqtt.subscribe("home/humidity", { qos: 1 })
  handleHumidity(message: { value: number }) {
    this.logger.info(`Humidity: ${message.value}%`);
  }

  /**
   * Subscribe to sensors with string payload
   * Message is automatically parsed from Buffer to string
   * Here we include topic parameter to demonstrate logging the actual topic
   */
  @mqtt.subscribe("sensors/data", { qos: 0 })
  handleSensorData(topic: string, message: string) {
    this.logger.info(`Sensor data from ${topic}: ${message}`);
  }
}

console.log(`Subscriptions registered: ${MqttService.subscriptions.length}`);

try {
  // Connect to MQTT broker AFTER class is defined (decorators have run)
  await MqttService.connect({
    host: "localhost",
    port: 1883,
  });

  console.log("Connected successfully!");

  // Publish a test message after connection is established
  await mqtt.publish("home/temperature", { value: 23.5, unit: "C" });

  console.log("Message published!");
} catch (error) {
  console.error("Error:", error);
  process.exit(1);
}

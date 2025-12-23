import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { flag } from "../../decorators/command/flag.js";
import { nativeCwd } from "../../runtime/native_cwd.js";
import { Command } from "../base_command.js";

type KeyType = "sync" | "async";

export default class KeyGenerateCommand extends Command {
  static commandName = "key-generate";
  static description = "Generate application encryption key pairs";
  static help = [
    "Generate secure RSA public/private key pairs for application encryption",
    "Keys are automatically saved to .env file",
    "Example: npx balda key-generate",
    "Example: npx balda key-generate --type async",
  ];

  @flag.string({
    aliases: ["t"],
    name: "type",
    required: false,
    description: "Key type: sync or async (default: sync)",
  })
  static type?: string;

  static async handle(): Promise<void> {
    const keyType = (this.type ?? "sync") as KeyType;

    if (!["sync", "async"].includes(keyType)) {
      this.logger.error(`Invalid key type: ${keyType}. Must be sync or async`);
      return;
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    const publicKeyName =
      keyType === "sync" ? "APP_PUBLIC_KEY" : "APP_PUBLIC_KEY_ASYNC";
    const privateKeyName =
      keyType === "sync" ? "APP_PRIVATE_KEY" : "APP_PRIVATE_KEY_ASYNC";
    const label = keyType === "sync" ? "Sync" : "Async";

    console.log(`\n✨ Generated ${label} Key Pair:\n`);
    console.log(`\x1b[33mPublic Key (${publicKeyName}):\x1b[0m`);
    console.log(`\x1b[32m${publicKey}\x1b[0m`);
    console.log(`\x1b[33mPrivate Key (${privateKeyName}):\x1b[0m`);
    console.log(`\x1b[32m${privateKey}\x1b[0m`);

    await this.saveKeyToEnvFile(publicKeyName, publicKey);
    await this.saveKeyToEnvFile(privateKeyName, privateKey);

    console.log(
      `\x1b[90m💡 Keys saved to .env file as ${publicKeyName} and ${privateKeyName}\x1b[0m\n`,
    );
  }

  private static async saveKeyToEnvFile(
    keyName: string,
    key: string,
  ): Promise<void> {
    const envPath = path.join(nativeCwd.getCwd(), ".env");
    const keyLine = `${keyName}="${key}"`;

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const keyRegex = new RegExp(`^${keyName}=.*$`, "m");

      if (keyRegex.test(envContent)) {
        const updatedContent = envContent.replace(keyRegex, keyLine);
        fs.writeFileSync(envPath, updatedContent);
        this.logger.info(`Updated ${keyName} in .env file`);
        return;
      }

      fs.appendFileSync(envPath, `\n${keyLine}\n`);
      this.logger.info(`Added ${keyName} to .env file`);
      return;
    }

    fs.writeFileSync(envPath, `${keyLine}\n`);
    this.logger.info(`Created .env file with ${keyName}`);
  }
}

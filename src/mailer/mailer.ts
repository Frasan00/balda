import { MailProvider } from "./mail_provider.js";
import {
  InvalidDefaultProviderError,
  ProviderNotFoundError,
} from "./mailer_errors.js";
import type {
  MailerInterface,
  MailerOptions,
  MailerProviderOptions,
  MailOptions,
  MailProviderInterface,
  TemplateMailOptions,
} from "./mailer_types.js";

export class Mailer<
  T extends MailerProviderOptions,
> implements MailerInterface {
  private readonly defaultProvider: keyof T;
  private readonly providerMap: Map<keyof T, MailProviderInterface>;

  constructor(providerOptions: T, mailerOptions: MailerOptions<T>) {
    if (!providerOptions[mailerOptions.defaultProvider]) {
      throw new InvalidDefaultProviderError(
        String(mailerOptions.defaultProvider),
      );
    }

    this.defaultProvider = mailerOptions.defaultProvider;
    this.providerMap = new Map(
      (Object.keys(providerOptions) as Array<keyof T>).map((key) => [
        key,
        new MailProvider(providerOptions[key]),
      ]),
    );
  }

  /**
   * Use a specific mail provider
   * @param provider - The provider to use
   * @returns The mail provider instance
   */
  use(provider: keyof T): MailProviderInterface {
    const providerInstance = this.providerMap.get(provider);
    if (!providerInstance) {
      throw new ProviderNotFoundError(String(provider));
    }

    return providerInstance;
  }

  async send(options: MailOptions): Promise<void> {
    const provider = this.getDefaultProvider();
    return provider.send(options);
  }

  async sendWithTemplate(options: TemplateMailOptions): Promise<void> {
    const provider = this.getDefaultProvider();
    return provider.sendWithTemplate(options);
  }

  async verify(): Promise<boolean> {
    const provider = this.getDefaultProvider();
    return provider.verify();
  }

  private getDefaultProvider(): MailProviderInterface {
    const providerInstance = this.providerMap.get(this.defaultProvider);
    if (!providerInstance) {
      throw new ProviderNotFoundError(String(this.defaultProvider));
    }

    return providerInstance;
  }
}

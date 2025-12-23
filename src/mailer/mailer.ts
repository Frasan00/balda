import { memoryQueue } from "../queue/factories.js";
import type { TypedQueue } from "../queue/typed_queue.js";
import { MailOptionsBuilder } from "./mail_options_builder.js";
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

type QueuedEmail = {
  options: MailOptions | TemplateMailOptions;
  isTemplate: boolean;
};

export class Mailer<
  T extends MailerProviderOptions,
> implements MailerInterface {
  private readonly defaultProvider: keyof T;
  private readonly providerMap: Map<keyof T, MailProviderInterface>;
  private emailQueue: TypedQueue<QueuedEmail, "memory"> | null = null;
  private queueInitialized = false;

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

  async send(
    builderFn: (builder: MailOptionsBuilder) => MailOptionsBuilder | void,
  ): Promise<void> {
    const provider = this.getDefaultProvider();
    return provider.send(builderFn);
  }

  async later(
    builderFn: (builder: MailOptionsBuilder) => MailOptionsBuilder | void,
  ): Promise<void> {
    await this.initializeQueue();

    const builder = new MailOptionsBuilder();
    const result = builderFn(builder);
    const finalBuilder = result ?? builder;

    const options = finalBuilder.build();
    const isTemplate = finalBuilder.hasTemplate();

    await this.emailQueue!.publish({ options, isTemplate });
  }

  private async initializeQueue(): Promise<void> {
    if (this.queueInitialized) {
      return;
    }

    this.emailQueue = memoryQueue<QueuedEmail>("mailer-emails");

    await this.emailQueue.subscribe(async (queuedEmail) => {
      await this.processEmail(queuedEmail);
    });

    this.queueInitialized = true;
  }

  private async processEmail(queuedEmail: QueuedEmail): Promise<void> {
    try {
      const provider = this.getDefaultProvider();

      await provider.send((builder) => {
        const options = queuedEmail.options;
        builder.to(options.to).subject(options.subject);

        if (options.from) {
          builder.from(options.from);
        }
        if (options.cc) {
          builder.cc(options.cc);
        }
        if (options.bcc) {
          builder.bcc(options.bcc);
        }
        if ("text" in options && options.text) {
          builder.text(options.text);
        }
        if ("html" in options && options.html) {
          builder.html(options.html);
        }
        if (options.attachments) {
          builder.attachments(options.attachments);
        }

        if (queuedEmail.isTemplate) {
          const templateOpts = options as TemplateMailOptions;
          if (templateOpts.isFilePath) {
            builder.templateFile(templateOpts.template, templateOpts.data);
          } else {
            builder.template(templateOpts.template, templateOpts.data);
          }
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("[Mailer] Failed to send queued email:", error);
    }
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

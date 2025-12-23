import { MailOptionsBuilder } from "./mail_options_builder.js";
import { TemplateAdapterNotConfiguredError } from "./mailer_errors.js";
import type {
  Email,
  MailOptions,
  MailProviderInterface,
  MailProviderOptions,
  TemplateMailOptions,
} from "./mailer_types.js";

export class MailProvider implements MailProviderInterface {
  private readonly transporter: MailProviderOptions["transporter"];
  private readonly templateAdapter?: MailProviderOptions["templateAdapter"];
  private readonly defaultFrom?: Email;

  constructor(options: MailProviderOptions) {
    this.transporter = options.transporter;
    this.templateAdapter = options.templateAdapter;
    this.defaultFrom = options.from;
  }

  async send(
    builderFn: (builder: MailOptionsBuilder) => MailOptionsBuilder | void,
  ): Promise<void> {
    const builder = new MailOptionsBuilder();
    const result = builderFn(builder);
    const finalBuilder = result ?? builder;

    const options = finalBuilder.build();

    if (finalBuilder.hasTemplate()) {
      return this.sendWithTemplate(options as TemplateMailOptions);
    }

    return this.sendDirect(options as MailOptions);
  }

  private async sendDirect(options: MailOptions): Promise<void> {
    const mailOptions = {
      ...options,
      from: options.from || this.defaultFrom,
    };

    return this.transporter.sendMail(mailOptions);
  }

  private async sendWithTemplate(options: TemplateMailOptions): Promise<void> {
    if (!this.templateAdapter) {
      throw new TemplateAdapterNotConfiguredError();
    }

    const html = options.isFilePath
      ? await this.templateAdapter.renderFromFile(
          options.template,
          options.data,
        )
      : await this.templateAdapter.render(options.template, options.data);

    const mailOptions: MailOptions = {
      ...options,
      html,
      from: options.from || this.defaultFrom,
    };

    await this.sendDirect(mailOptions);
  }

  async verify(): Promise<boolean> {
    return this.transporter.verify();
  }
}

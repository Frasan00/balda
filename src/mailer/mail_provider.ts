import { TemplateAdapterNotConfiguredError } from "./mailer_errors.js";
import type {
  MailOptions,
  MailProviderInterface,
  MailProviderOptions,
  TemplateMailOptions,
} from "./mailer_types.js";

export class MailProvider implements MailProviderInterface {
  private readonly transporter: MailProviderOptions["transporter"];
  private readonly templateAdapter?: MailProviderOptions["templateAdapter"];
  private readonly defaultFrom?: string;

  constructor(options: MailProviderOptions) {
    this.transporter = options.transporter;
    this.templateAdapter = options.templateAdapter;
    this.defaultFrom = options.from;
  }

  async send(options: MailOptions): Promise<void> {
    const mailOptions = {
      ...options,
      from: options.from || this.defaultFrom,
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendWithTemplate(options: TemplateMailOptions): Promise<void> {
    if (!this.templateAdapter) {
      throw new TemplateAdapterNotConfiguredError();
    }

    const html = await this.templateAdapter.render(
      options.template,
      options.data,
    );

    const mailOptions: MailOptions = {
      ...options,
      html,
      from: options.from || this.defaultFrom,
    };

    await this.send(mailOptions);
  }

  async verify(): Promise<boolean> {
    return this.transporter.verify();
  }
}

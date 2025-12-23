import type {
  Attachment,
  MailOptions,
  TemplateMailOptions,
} from "./mailer_types.js";

/**
 * Email address type that enforces the basic email format
 */
export type Email = `${string}@${string}`;

/**
 * Builder for constructing email options
 */
export class MailOptionsBuilder {
  private options: Partial<MailOptions> = {};
  private templateOptions?: {
    template: string;
    data: Record<string, unknown>;
    isFilePath: boolean;
  };

  /**
   * Set the sender email address
   * @param email - The sender email address
   */
  from(email: Email): this {
    this.options.from = email;
    return this;
  }

  /**
   * Set recipient email address(es)
   * @param email - Single email address or array of email addresses
   */
  to(email: Email | Email[]): this {
    this.options.to = email;
    return this;
  }

  /**
   * Set carbon copy recipient email address(es)
   * @param email - Single email address or array of email addresses
   */
  cc(email: Email | Email[]): this {
    this.options.cc = email;
    return this;
  }

  /**
   * Set blind carbon copy recipient email address(es)
   * @param email - Single email address or array of email addresses
   */
  bcc(email: Email | Email[]): this {
    this.options.bcc = email;
    return this;
  }

  /**
   * Set email subject
   * @param text - The email subject line
   */
  subject(text: string): this {
    this.options.subject = text;
    return this;
  }

  /**
   * Set plain text email body
   * @param content - The plain text content of the email
   */
  text(content: string): this {
    this.options.text = content;
    return this;
  }

  /**
   * Set HTML email body
   * @param content - The HTML content of the email
   */
  html(content: string): this {
    this.options.html = content;
    return this;
  }

  /**
   * Set template string and data for rendering
   * @param template - The template string to render
   * @param data - The data to pass to the template for rendering
   */
  template(template: string, data: Record<string, unknown>): this {
    this.templateOptions = { template, data, isFilePath: false };
    return this;
  }

  /**
   * Set template file path and data for rendering
   * @param templatePath - The path to the template file
   * @param data - The data to pass to the template for rendering
   */
  templateFile(templatePath: string, data: Record<string, unknown>): this {
    this.templateOptions = { template: templatePath, data, isFilePath: true };
    return this;
  }

  /**
   * Add an attachment
   * @param attachment - The attachment to add to the email
   */
  attachment(attachment: Attachment): this {
    if (!this.options.attachments) {
      this.options.attachments = [];
    }
    this.options.attachments.push(attachment);
    return this;
  }

  /**
   * Add multiple attachments
   * @param attachments - Array of attachments to add to the email
   */
  attachments(attachments: Attachment[]): this {
    if (!this.options.attachments) {
      this.options.attachments = [];
    }
    this.options.attachments.push(...attachments);
    return this;
  }

  /**
   * Check if this builder has template options
   */
  hasTemplate(): boolean {
    return !!this.templateOptions;
  }

  /**
   * Check if the template is a file path
   */
  isTemplateFile(): boolean {
    return !!this.templateOptions?.isFilePath;
  }

  /**
   * Build the final MailOptions or TemplateMailOptions object
   */
  build(): MailOptions | TemplateMailOptions {
    if (!this.options.to) {
      throw new Error("[MailOptionsBuilder] 'to' field is required");
    }
    if (!this.options.subject) {
      throw new Error("[MailOptionsBuilder] 'subject' field is required");
    }

    if (this.templateOptions) {
      const { text, html, ...rest } = this.options;
      return {
        ...rest,
        template: this.templateOptions.template,
        data: this.templateOptions.data,
        isFilePath: this.templateOptions.isFilePath,
      } as TemplateMailOptions;
    }

    return this.options as MailOptions;
  }
}

/**
 * Helper function to create a new MailOptionsBuilder
 */
export const mailOptions = (): MailOptionsBuilder => new MailOptionsBuilder();

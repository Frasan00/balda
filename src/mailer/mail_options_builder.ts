import type { Attachment, MailOptions } from "./mailer_types.js";

/**
 * Builder for constructing email options
 */
export class MailOptionsBuilder {
  private options: Partial<MailOptions> = {};

  /**
   * Set the sender email address
   */
  from(email: string): this {
    this.options.from = email;
    return this;
  }

  /**
   * Set recipient email address(es)
   */
  to(email: string | string[]): this {
    this.options.to = email;
    return this;
  }

  /**
   * Set carbon copy recipient email address(es)
   */
  cc(email: string | string[]): this {
    this.options.cc = email;
    return this;
  }

  /**
   * Set blind carbon copy recipient email address(es)
   */
  bcc(email: string | string[]): this {
    this.options.bcc = email;
    return this;
  }

  /**
   * Set email subject
   */
  subject(text: string): this {
    this.options.subject = text;
    return this;
  }

  /**
   * Set plain text email body
   */
  text(content: string): this {
    this.options.text = content;
    return this;
  }

  /**
   * Set HTML email body
   */
  html(content: string): this {
    this.options.html = content;
    return this;
  }

  /**
   * Add an attachment
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
   */
  attachments(attachments: Attachment[]): this {
    if (!this.options.attachments) {
      this.options.attachments = [];
    }
    this.options.attachments.push(...attachments);
    return this;
  }

  /**
   * Build the final MailOptions object
   */
  build(): MailOptions {
    if (!this.options.to) {
      throw new Error("[MailOptionsBuilder] 'to' field is required");
    }
    if (!this.options.subject) {
      throw new Error("[MailOptionsBuilder] 'subject' field is required");
    }

    return this.options as MailOptions;
  }
}

/**
 * Helper function to create a new MailOptionsBuilder
 */
export const mailOptions = (): MailOptionsBuilder => new MailOptionsBuilder();

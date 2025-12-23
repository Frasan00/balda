import { BaldaError } from "../../errors/balda_error.js";
import type { TemplateAdapter } from "../mailer_types.js";

/**
 * EJS template adapter
 * Requires: npm install ejs @types/ejs
 */
export class EjsAdapter implements TemplateAdapter {
  declare private ejs: typeof import("ejs");
  private options: Record<string, unknown>;

  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
  }

  async render(
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureEjs();
    return this.ejs.render(template, data, this.options);
  }

  async renderFromFile(
    templatePath: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureEjs();
    return this.ejs.renderFile(templatePath, data, this.options);
  }

  private async ensureEjs(): Promise<void> {
    if (this.ejs) {
      return;
    }

    const ejsModule = await import("ejs").catch(() => {
      throw new BaldaError(
        "Library not installed: ejs, try run npm install ejs @types/ejs",
      );
    });

    this.ejs = ejsModule.default || ejsModule;
  }
}

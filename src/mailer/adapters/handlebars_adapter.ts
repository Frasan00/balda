import { BaldaError } from "../../errors/balda_error.js";
import { nativeFs } from "../../runtime/native_fs.js";
import type { TemplateAdapter } from "../mailer_types.js";

/**
 * Handlebars template adapter
 * Requires: npm install handlebars @types/handlebars
 */
export class HandlebarsAdapter implements TemplateAdapter {
  declare private handlebars: typeof import("handlebars");

  async render(
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureHandlebars();
    const compiledTemplate = this.handlebars.compile(template);
    return compiledTemplate(data);
  }

  async renderFromFile(
    templatePath: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const templateContent = await nativeFs.readFile(templatePath, {
      encoding: "utf8",
    });
    return this.render(templateContent as string, data);
  }

  /**
   * Register a helper function
   */
  async registerHelper(
    name: string,
    fn: (...args: unknown[]) => unknown,
  ): Promise<void> {
    await this.ensureHandlebars();
    this.handlebars.registerHelper(name, fn);
  }

  /**
   * Register a partial template
   */
  async registerPartial(name: string, template: string): Promise<void> {
    await this.ensureHandlebars();
    this.handlebars.registerPartial(name, template);
  }

  private async ensureHandlebars(): Promise<void> {
    if (this.handlebars) {
      return;
    }

    const handlebarsModule = await import("handlebars").catch(() => {
      throw new BaldaError(
        "Library not installed: handlebars, try run npm install handlebars @types/handlebars",
      );
    });

    const mod = handlebarsModule as any;
    this.handlebars = mod.default?.default || mod.default || mod;
  }
}

import { BaldaError } from "../../errors/balda_error.js";
import { nativeFs } from "../../runtime/native_fs.js";
import type { TemplateAdapter } from "../mailer_types.js";

/**
 * Mustache template adapter
 * Requires: npm install mustache @types/mustache
 */
export class MustacheAdapter implements TemplateAdapter {
  declare private mustache: {
    render: (
      template: string,
      data: Record<string, unknown>,
      partials: Record<string, string>,
    ) => string;
  };
  private partials: Record<string, string> = {};

  async render(
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureMustache();
    return this.mustache.render(template, data, this.partials);
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
   * Register a partial template
   */
  registerPartial(name: string, template: string): void {
    this.partials[name] = template;
  }

  private async ensureMustache(): Promise<void> {
    if (this.mustache) {
      return;
    }

    const mustacheModule = await import("mustache").catch(() => {
      throw new BaldaError(
        "Library not installed: mustache, try run npm install mustache @types/mustache",
      );
    });

    this.mustache = mustacheModule.default || mustacheModule;
  }
}

export type RunTimeType = "bun" | "node" | "deno";

export class RunTime {
  type: RunTimeType;

  constructor() {
    this.type = this.getRunTime();
  }

  private getRunTime(): RunTimeType {
    if (typeof Bun !== "undefined") {
      return "bun";
    } else if (typeof process !== "undefined") {
      return "node";
    } else if (typeof Deno !== "undefined") {
      return "deno";
    }

    throw new Error("No environment detected");
  }
}

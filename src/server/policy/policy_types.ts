import type { PolicyManager } from "./policy_manager.js";

export type PolicyProvider = {
  [K: string]: (...args: any[]) => Promise<boolean> | boolean;
};

export type PolicyMetadata = {
  scope: string;
  handler: string;
  manager: PolicyManager<any>;
};

export type PolicyDecorator<T extends Record<string, PolicyProvider>> = <
  S extends keyof T & string,
  H extends keyof T[S] & string,
>(
  scope: S,
  handler: H,
) => (
  target: any,
  propertyKey?: string,
  descriptor?: PropertyDescriptor,
) => any;

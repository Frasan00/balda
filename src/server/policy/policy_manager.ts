import { BaldaError } from "../../errors/balda_error.js";
import { createPolicyDecorator } from "./policy_decorator.js";
import type { PolicyDecorator, PolicyProvider } from "./policy_types.js";

export class PolicyManager<T extends Record<string, PolicyProvider>> {
  private readonly providers: T;

  constructor(providers: T) {
    this.providers = providers;
  }

  /**
   * Creates a decorator for the policy manager with typed parameters
   */
  createDecorator(): PolicyDecorator<T> {
    return createPolicyDecorator(this);
  }

  /**
   * Checks if the user has access to the given scope and handler
   * @param scope - The scope to check access for
   * @param handler - The handler to check access for
   * @param args - The arguments to pass to the handler
   */
  canAccess<K extends keyof T, L extends T[K]>(
    scope: K,
    handler: keyof L,
    ...args: Parameters<T[K][keyof T[K]]>
  ): ReturnType<T[K][keyof T[K]]> {
    const provider = this.providers[scope];
    if (!provider) {
      throw new BaldaError(`Policy provider for ${String(scope)} not found`);
    }

    return provider[handler as keyof T[K]](...args) as ReturnType<
      T[K][keyof T[K]]
    >;
  }
}

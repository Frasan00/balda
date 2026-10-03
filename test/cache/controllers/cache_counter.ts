/** Shared counter used by CacheTestController to track actual handler invocations */
export let callCount = 0;

export function getCallCount(): number {
  return callCount;
}

export function resetCallCount(): void {
  callCount = 0;
}

export function incrementCallCount(): void {
  callCount++;
}

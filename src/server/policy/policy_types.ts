export type PolicyProvider = {
  [K: string]: (...args: any[]) => Promise<boolean> | boolean;
};

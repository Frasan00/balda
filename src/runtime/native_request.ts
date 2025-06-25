declare global {
  interface Request {
    params: Record<string, string>;
  }
}

export class NativeRequest extends Request {}

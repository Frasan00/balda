import type {
  ErrorRequestHandler as ExpressErrorMiddleware,
  RequestHandler as ExpressMiddleware,
  NextFunction as ExpressNextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
  IRouter,
} from "express";

export type {
  ExpressErrorMiddleware,
  ExpressMiddleware,
  ExpressNextFunction,
  ExpressRequest,
  ExpressResponse,
};

export type ExpressHandler = ExpressMiddleware;

export type ExpressRouter = IRouter;

export interface ExpressAdapterOptions {
  basePath?: string;
}

export interface ExpressResponseWrapper {
  locals: Record<string, any>;
  headersSent: boolean;
  statusCode: number;
  status(code: number): this;
  sendStatus(code: number): this;
  send(body?: any): this;
  json(body?: any): this;
  redirect(statusOrUrl: number | string, url?: string): this;
  setHeader(name: string, value: string | number | readonly string[]): this;
  set(field: string | Record<string, string>, value?: string): this;
  header(field: string | Record<string, string>, value?: string): this;
  type(contentType: string): this;
  contentType(type: string): this;
  end(data?: any): this;
  write(chunk: any): boolean;
  get(name: string): string | undefined;
  getHeader(name: string): string | undefined;
  removeHeader(name: string): this;
  append(field: string, value: string | string[]): this;
  cookie(name: string, value: string, options?: any): this;
  clearCookie(name: string, options?: any): this;
  render(view: string, options?: any, callback?: any): void;
  format(obj: any): this;
  attachment(filename?: string): this;
  sendFile(path: string, options?: any, fn?: any): void;
  download(
    path: string,
    filename?: string | any,
    options?: any,
    fn?: any,
  ): void;
  links(links: Record<string, string>): this;
  location(url: string): this;
  vary(field: string): this;
  app: Record<string, any>;
  req: null;
}

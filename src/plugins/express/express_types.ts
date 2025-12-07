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

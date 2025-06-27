import { HelmetOptions } from "src/plugins/helmet/helmet_types";
import type { ServerRouteMiddleware } from "../../runtime/native_server/server_types";
import type { NextFunction } from "../../server/http/next";
import type { Request } from "../../server/http/request";
import type { Response } from "../../server/http/response";

/**
 * Sets common HTTP security headers
 * @param options Helmet options (all optional)
 */
export const helmet = (options?: HelmetOptions): ServerRouteMiddleware => {
  const opts: Required<HelmetOptions> = {
    dnsPrefetchControl: true,
    frameguard: { action: "SAMEORIGIN" },
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: false },
    contentTypeOptions: true,
    ieNoOpen: true,
    xssFilter: true,
    referrerPolicy: "no-referrer",
    crossOriginResourcePolicy: "same-origin",
    crossOriginOpenerPolicy: "same-origin",
    crossOriginEmbedderPolicy: "require-corp",
    contentSecurityPolicy: false,
    ...options,
  };

  return async (_req: Request, res: Response, next: NextFunction) => {
    // X-DNS-Prefetch-Control
    if (opts.dnsPrefetchControl) {
      res.setHeader("X-DNS-Prefetch-Control", "off");
    }
    // X-Frame-Options
    if (opts.frameguard) {
      let action = "SAMEORIGIN";
      if (typeof opts.frameguard === "object") {
        action = opts.frameguard.action;
      }
      res.setHeader("X-Frame-Options", action);
    }
    // Strict-Transport-Security
    if (opts.hsts) {
      let hstsRaw: Partial<{
        maxAge: number;
        includeSubDomains: boolean;
        preload: boolean;
      }> = {};
      if (typeof opts.hsts === "object") {
        hstsRaw = opts.hsts;
      }
      const maxAge = hstsRaw.maxAge !== undefined ? hstsRaw.maxAge : 15552000;
      const includeSubDomains =
        hstsRaw.includeSubDomains !== undefined
          ? hstsRaw.includeSubDomains
          : true;
      const preload = hstsRaw.preload !== undefined ? hstsRaw.preload : false;
      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains !== false) {
        hstsValue += "; includeSubDomains";
      }
      if (preload) {
        hstsValue += "; preload";
      }
      res.setHeader("Strict-Transport-Security", hstsValue);
    }
    // X-Content-Type-Options
    if (opts.contentTypeOptions) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
    // X-Download-Options
    if (opts.ieNoOpen) {
      res.setHeader("X-Download-Options", "noopen");
    }
    // X-XSS-Protection
    if (opts.xssFilter) {
      res.setHeader("X-XSS-Protection", "0");
    }
    // Referrer-Policy
    if (opts.referrerPolicy) {
      res.setHeader("Referrer-Policy", opts.referrerPolicy);
    }
    // Cross-Origin-Resource-Policy
    if (opts.crossOriginResourcePolicy) {
      res.setHeader(
        "Cross-Origin-Resource-Policy",
        opts.crossOriginResourcePolicy,
      );
    }
    // Cross-Origin-Opener-Policy
    if (opts.crossOriginOpenerPolicy) {
      res.setHeader("Cross-Origin-Opener-Policy", opts.crossOriginOpenerPolicy);
    }
    // Cross-Origin-Embedder-Policy
    if (opts.crossOriginEmbedderPolicy) {
      res.setHeader(
        "Cross-Origin-Embedder-Policy",
        opts.crossOriginEmbedderPolicy,
      );
    }
    // Content-Security-Policy
    if (opts.contentSecurityPolicy) {
      res.setHeader("Content-Security-Policy", opts.contentSecurityPolicy);
    }

    await next();
  };
};

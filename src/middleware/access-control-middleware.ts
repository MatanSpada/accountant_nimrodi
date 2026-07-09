import type { MiddlewareHandler } from "hono";

import type { AppConfig } from "../shared/config/app-config";
import { isAdminSessionAuthenticated } from "../domain/auth/admin-session";

function isAdminPagePath(path: string) {
  return path === "/" || path.startsWith("/admin/");
}

function isProtectedApiPath(path: string) {
  return path === "/api/payments" || path.startsWith("/api/payments/");
}

function isDevToolPath(path: string) {
  return path === "/api/mock-grow/webhook" || path.startsWith("/dev/");
}

function isPublicPath(path: string) {
  return (
    path === "/health" ||
    path === "/ready" ||
    path === "/login" ||
    path === "/logout" ||
    path === "/api/grow/webhook"
  );
}

function isHtmlPath(path: string) {
  return isAdminPagePath(path) || path.startsWith("/dev/");
}

function loginRedirect(path: string) {
  const redirectTarget = encodeURIComponent(path === "/" ? "/" : path);
  return `/login?next=${redirectTarget}`;
}

export function accessControlMiddleware(
  getConfig: (env?: Env) => AppConfig
): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const path = c.req.path;

    if (isPublicPath(path)) {
      await next();
      return;
    }

    const config = getConfig(c.env);
    const devToolPath = isDevToolPath(path);

    if (devToolPath && !config.enableDevTools) {
      if (path.startsWith("/api/")) {
        return c.json({ error: "כלי הפיתוח כבויים בסביבה הנוכחית." }, 404);
      }

      return c.text("כלי הפיתוח כבויים בסביבה הנוכחית.", 404);
    }

    const requiresAuth =
      isAdminPagePath(path) || isProtectedApiPath(path) || devToolPath;

    if (!requiresAuth) {
      await next();
      return;
    }

    const authenticated = await isAdminSessionAuthenticated(c, config);
    if (authenticated) {
      await next();
      return;
    }

    if (isHtmlPath(path)) {
      return c.redirect(loginRedirect(path), 302);
    }

    return c.json({ error: "נדרשת התחברות לאזור הניהול." }, 401);
  };
}

import type { Hono } from "hono";

import type { AppConfig } from "../shared/config/app-config";
import {
  clearAdminSessionCookie,
  isAdminSessionAuthenticated,
  setAdminSessionCookie
} from "../domain/auth/admin-session";
import { renderLoginPage } from "../ui/admin/admin-page";

export function registerAuthRoutes(
  app: Hono<{ Bindings: Env }>,
  getConfig: (env?: Env) => AppConfig
) {
  app.get("/login", async (c) => {
    const config = getConfig(c.env);
    const alreadyAuthenticated = await isAdminSessionAuthenticated(c, config);
    if (alreadyAuthenticated) {
      return c.redirect("/", 302);
    }

    return c.html(
      renderLoginPage({
        appConfig: config,
        errorMessage: c.req.query("error") ?? null,
        nextPath: c.req.query("next") ?? "/"
      })
    );
  });

  app.post("/login", async (c) => {
    const config = getConfig(c.env);
    const formData = await c.req.formData();
    const password = String(formData.get("password") ?? "");
    const nextPath = String(formData.get("next") ?? "/");

    if (password !== config.adminPassword) {
      return c.redirect(
        `/login?error=${encodeURIComponent("סיסמת הניהול שגויה.")}&next=${encodeURIComponent(nextPath)}`,
        302
      );
    }

    await setAdminSessionCookie(c, config);
    return c.redirect(nextPath.startsWith("/") ? nextPath : "/", 302);
  });

  app.post("/logout", (c) => {
    clearAdminSessionCookie(c, getConfig(c.env));
    return c.redirect("/login", 302);
  });
}

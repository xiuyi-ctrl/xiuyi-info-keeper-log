import { createMiddleware } from "@tanstack/react-start";
import { getStoredToken } from "@/lib/client-auth";

export const attachVaultAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getStoredToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});

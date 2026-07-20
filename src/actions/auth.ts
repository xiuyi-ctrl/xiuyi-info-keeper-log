import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/server/db";
import { signToken, verifyToken } from "@/server/auth";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
};

export const registerFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    if (!d || typeof d !== "object") throw new Error("Invalid request");
    const obj = d as Record<string, unknown>;
    if (typeof obj.email !== "string" || typeof obj.password !== "string")
      throw new Error("Invalid request");
    return { email: obj.email, password: obj.password };
  })
  .handler(async ({ data }) => {
    const { email, password } = data;
    if (!email || !password) throw new Error("邮箱和密码不能为空");
    if (password.length < 6) throw new Error("密码至少需要 6 个字符");

    const existing = await queryOne<UserRow>("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) throw new Error("该邮箱已注册");

    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, 10);
    const token = signToken({ userId: id, email });

    await query("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
      id,
      email,
      password_hash,
    ]);

    return { token, user: { id, email } };
  });

export const loginFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    if (!d || typeof d !== "object") throw new Error("Invalid request");
    const obj = d as Record<string, unknown>;
    if (typeof obj.email !== "string" || typeof obj.password !== "string")
      throw new Error("Invalid request");
    return { email: obj.email, password: obj.password };
  })
  .handler(async ({ data }) => {
    const { email, password } = data;
    if (!email || !password) throw new Error("邮箱和密码不能为空");

    const user = await queryOne<UserRow>(
      "SELECT id, email, password_hash FROM users WHERE email = ?",
      [email],
    );
    if (!user) throw new Error("邮箱或密码错误");

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error("邮箱或密码错误");

    const token = signToken({ userId: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email } };
  });

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async ({ request }) => {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const payload = verifyToken(auth.slice(7));
  if (!payload) return null;

  const user = await queryOne<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE id = ?",
    [payload.userId],
  );
  return user ?? null;
});

import jwt from "jsonwebtoken";

const SECRET = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET 环境变量未配置");
  return s;
};

export type JwtPayload = {
  userId: string;
  email: string;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const raw = jwt.verify(token, SECRET()) as Record<string, unknown>;
    if (typeof raw.userId !== "string" || typeof raw.email !== "string") return null;
    return { userId: raw.userId, email: raw.email };
  } catch {
    return null;
  }
}

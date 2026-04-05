import { createHmac, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET || "automind-secret-key-2024";

export function hashPassword(password: string): string {
  return createHmac("sha256", JWT_SECRET).update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  const inputHash = hashPassword(password);
  try {
    return timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function generateToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    return decoded;
  } catch {
    return null;
  }
}

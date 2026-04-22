import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken } from "./auth";

export async function getAuthenticatedUser(req: {
  headers: { authorization?: string | string[] | undefined };
}) {
  const rawHeader = req.headers.authorization;
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId));
  return user ?? null;
}

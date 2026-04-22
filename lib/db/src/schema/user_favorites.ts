import { pgTable, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userFavoritesTable = pgTable("user_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  carId: integer("car_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userCarUnique: uniqueIndex("user_favorites_user_car_idx").on(table.userId, table.carId),
}));

export type UserFavorite = typeof userFavoritesTable.$inferSelect;

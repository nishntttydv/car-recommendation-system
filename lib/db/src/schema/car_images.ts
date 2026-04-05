import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const carImagesTable = pgTable("car_images", {
  id: serial("id").primaryKey(),
  carId: text("car_id").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCarImageSchema = createInsertSchema(carImagesTable).omit({ id: true, createdAt: true });
export type InsertCarImage = z.infer<typeof insertCarImageSchema>;
export type CarImage = typeof carImagesTable.$inferSelect;

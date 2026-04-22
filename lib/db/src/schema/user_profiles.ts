import { pgTable, serial, integer, text, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  budgetMin: real("budget_min"),
  budgetMax: real("budget_max"),
  householdSize: integer("household_size"),
  primaryUse: text("primary_use"),
  preferredBodyTypes: text("preferred_body_types").array().notNull().default([]),
  preferredFuelTypes: text("preferred_fuel_types").array().notNull().default([]),
  preferredTransmissions: text("preferred_transmissions").array().notNull().default([]),
  preferredBrands: text("preferred_brands").array().notNull().default([]),
  profileStage: text("profile_stage").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;

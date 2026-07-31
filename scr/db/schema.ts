import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

// General leads (non-wholesale) so wholesale opportunities can be separated out.
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 256 }).notNull(),
  contactPerson: varchar("contact_person", { length: 256 }),
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 64 }),
  industry: varchar("industry", { length: 128 }),
  leadSource: varchar("lead_source", { length: 128 }),
  priority: varchar("priority", { length: 32 }).notNull().default("Medium"),
  status: varchar("status", { length: 48 }).notNull().default("New"),
  lastContactDate: date("last_contact_date"),
  nextFollowUpDate: date("next_follow_up_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Dedicated wholesale leads table with the key tracking fields.
export const wholesaleLeads = pgTable("wholesale_leads", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 256 }).notNull(),
  contactPerson: varchar("contact_person", { length: 256 }),
  email: varchar("email", { length: 256 }),
  phone: varchar("phone", { length: 64 }),
  industry: varchar("industry", { length: 128 }),
  leadSource: varchar("lead_source", { length: 128 }),
  priority: varchar("priority", { length: 32 }).notNull().default("Medium"),
  status: varchar("status", { length: 48 }).notNull().default("New"),
  lastContactDate: date("last_contact_date"),
  nextFollowUpDate: date("next_follow_up_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type WholesaleLead = typeof wholesaleLeads.$inferSelect;
export type NewWholesaleLead = typeof wholesaleLeads.$inferInsert;

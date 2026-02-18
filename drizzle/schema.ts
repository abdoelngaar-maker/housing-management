import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  sectorId: int("sectorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Sectors (e.g. الضبعة، هايسندا)
export const sectors = mysqlTable("sectors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#3b82f6"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Sector = typeof sectors.$inferSelect;
export type InsertSector = typeof sectors.$inferInsert;

// Residential units (apartments and chalets)
export const units = mysqlTable("units", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  type: mysqlEnum("type", ["apartment", "chalet"]).notNull(),
  sectorId: int("sectorId"),
  floor: varchar("floor", { length: 20 }),
  rooms: int("rooms").default(1).notNull(),
  beds: int("beds").default(1).notNull(),
  status: mysqlEnum("status", ["vacant", "occupied", "maintenance"]).default("vacant").notNull(),
  currentOccupants: int("currentOccupants").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Unit = typeof units.$inferSelect;
export type InsertUnit = typeof units.$inferInsert;

// Egyptian residents
export const egyptianResidents = mysqlTable("egyptian_residents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  nationalId: varchar("nationalId", { length: 20 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  shift: varchar("shift", { length: 50 }),
  unitId: int("unitId"),
  checkInDate: bigint("checkInDate", { mode: "number" }),
  checkOutDate: bigint("checkOutDate", { mode: "number" }),
  status: mysqlEnum("status", ["active", "checked_out", "transferred"]).default("active").notNull(),
  ocrConfidence: int("ocrConfidence"),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EgyptianResident = typeof egyptianResidents.$inferSelect;
export type InsertEgyptianResident = typeof egyptianResidents.$inferInsert;

// Russian residents
export const russianResidents = mysqlTable("russian_residents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  passportNumber: varchar("passportNumber", { length: 50 }).notNull(),
  nationality: varchar("nationality", { length: 100 }).default("Russian").notNull(),
  gender: mysqlEnum("gender", ["male", "female"]).notNull(),
  phone: varchar("phone", { length: 20 }),
  shift: varchar("shift", { length: 50 }),
  unitId: int("unitId"),
  checkInDate: bigint("checkInDate", { mode: "number" }),
  checkOutDate: bigint("checkOutDate", { mode: "number" }),
  status: mysqlEnum("status", ["active", "checked_out", "transferred"]).default("active").notNull(),
  ocrConfidence: int("ocrConfidence"),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RussianResident = typeof russianResidents.$inferSelect;
export type InsertRussianResident = typeof russianResidents.$inferInsert;

// Occupancy records (housing log)
export const occupancyRecords = mysqlTable("occupancy_records", {
  id: int("id").autoincrement().primaryKey(),
  residentType: mysqlEnum("residentType", ["egyptian", "russian"]).notNull(),
  residentId: int("residentId").notNull(),
  residentName: varchar("residentName", { length: 200 }).notNull(),
  unitId: int("unitId").notNull(),
  unitCode: varchar("unitCode", { length: 50 }).notNull(),
  action: mysqlEnum("action", ["check_in", "check_out", "transfer_in", "transfer_out"]).notNull(),
  fromUnitId: int("fromUnitId"),
  fromUnitCode: varchar("fromUnitCode", { length: 50 }),
  notes: text("notes"),
  actionDate: bigint("actionDate", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OccupancyRecord = typeof occupancyRecords.$inferSelect;
export type InsertOccupancyRecord = typeof occupancyRecords.$inferInsert;

// Import logs
export const importLogs = mysqlTable("import_logs", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  totalRows: int("totalRows").default(0).notNull(),
  successRows: int("successRows").default(0).notNull(),
  failedRows: int("failedRows").default(0).notNull(),
  errors: json("errors"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  importedBy: varchar("importedBy", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportLog = typeof importLogs.$inferSelect;
export type InsertImportLog = typeof importLogs.$inferInsert;

// Notifications
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: mysqlEnum("type", ["info", "success", "warning", "error"]).default("info").notNull(),
  isRead: int("isRead").default(0).notNull(),
  userId: int("userId"),
  sectorId: int("sectorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

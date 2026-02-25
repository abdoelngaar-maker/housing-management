import { eq, and, like, sql, desc, or, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  sectors, InsertSector,
  units, InsertUnit, Unit,
  egyptianResidents, InsertEgyptianResident,
  russianResidents, InsertRussianResident,
  occupancyRecords, InsertOccupancyRecord,
  importLogs, InsertImportLog,
  notifications, InsertNotification,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function initializeDatabase() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot initialize: database not available");
    return;
  }
  
  console.log("[Database] Initializing tables...");
  
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`openId\` varchar(64) NOT NULL,
      \`name\` text,
      \`email\` varchar(320),
      \`loginMethod\` varchar(64),
      \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
      \`sectorId\` int,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      \`lastSignedIn\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`users_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`users_openId_unique\` UNIQUE(\`openId\`)
    )`);
    console.log("[Database] Table 'users' ready");

    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`sectors\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`name\` varchar(200) NOT NULL,
      \`code\` varchar(50) NOT NULL,
      \`description\` text,
      \`color\` varchar(20) DEFAULT '#3b82f6',
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`sectors_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`sectors_name_unique\` UNIQUE(\`name\`),
      CONSTRAINT \`sectors_code_unique\` UNIQUE(\`code\`)
    )`);
    console.log("[Database] Table 'sectors' ready");

    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`units\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`code\` varchar(50) NOT NULL,
      \`name\` varchar(200) NOT NULL,
      \`type\` enum('apartment','chalet') NOT NULL,
      \`sectorId\` int,
      \`floor\` varchar(20),
      \`rooms\` int NOT NULL DEFAULT 1,
      \`beds\` int NOT NULL DEFAULT 1,
      \`status\` enum('vacant','occupied','maintenance') NOT NULL DEFAULT 'vacant',
      \`currentOccupants\` int NOT NULL DEFAULT 0,
      \`ownerName\` varchar(255),
      \`buildingName\` varchar(255),
      \`notes\` text,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`units_id\` PRIMARY KEY(\`id\`),
      CONSTRAINT \`units_code_unique\` UNIQUE(\`code\`)
    )`);

    // Migration for existing units table to add new columns if they don't exist
    try {
      // Check if columns exist first to avoid errors on some MySQL versions
      const columns: any = await db.execute(sql`SHOW COLUMNS FROM \`units\``);
      const columnNames = columns[0].map((c: any) => c.Field);
      
      if (!columnNames.includes('ownerName')) {
        await db.execute(sql`ALTER TABLE \`units\` ADD COLUMN \`ownerName\` varchar(255)`);
        console.log("[Database] Migration: Added ownerName to units table");
      }
      if (!columnNames.includes('buildingName')) {
        await db.execute(sql`ALTER TABLE \`units\` ADD COLUMN \`buildingName\` varchar(255)`);
        console.log("[Database] Migration: Added buildingName to units table");
      }
    } catch (e) {
      console.error("[Database] Migration failed:", e);
    }
    console.log("[Database] Table 'units' ready");

    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`egyptian_residents\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`name\` varchar(200) NOT NULL,
      \`nationalId\` varchar(20) NOT NULL,
      \`phone\` varchar(20),
      \`shift\` varchar(50),
      \`unitId\` int,
      \`checkInDate\` bigint,
      \`checkOutDate\` bigint,
      \`status\` enum('active','checked_out','transferred') NOT NULL DEFAULT 'active',
      \`ocrConfidence\` int,
      \`imageUrl\` text,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`egyptian_residents_id\` PRIMARY KEY(\`id\`)
    )`);
    console.log("[Database] Table 'egyptian_residents' ready");

    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`russian_residents\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`name\` varchar(200) NOT NULL,
      \`passportNumber\` varchar(50) NOT NULL,
      \`nationality\` varchar(100) NOT NULL DEFAULT 'Russian',
      \`gender\` enum('male','female') NOT NULL,
      \`phone\` varchar(20),
      \`shift\` varchar(50),
      \`unitId\` int,
      \`checkInDate\` bigint,
      \`checkOutDate\` bigint,
      \`status\` enum('active','checked_out','transferred') NOT NULL DEFAULT 'active',
      \`ocrConfidence\` int,
      \`imageUrl\` text,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`russian_residents_id\` PRIMARY KEY(\`id\`)
    )`);
    console.log("[Database] Table 'russian_residents' ready");

    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`occupancy_records\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`residentType\` enum('egyptian','russian') NOT NULL,
      \`residentId\` int NOT NULL,
      \`residentName\` varchar(200) NOT NULL,
      \`unitId\` int NOT NULL,
      \`unitCode\` varchar(50) NOT NULL,
      \`action\` enum('check_in','check_out','transfer_in','transfer_out') NOT NULL,
      \`fromUnitId\` int,
      \`fromUnitCode\` varchar(50),
      \`notes\` text,
      \`actionDate\` bigint NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`occupancy_records_id\` PRIMARY KEY(\`id\`)
    )`);
    console.log("[Database] Table 'occupancy_records' ready");

    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`import_logs\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`fileName\` varchar(255) NOT NULL,
      \`totalRows\` int NOT NULL DEFAULT 0,
      \`successRows\` int NOT NULL DEFAULT 0,
      \`failedRows\` int NOT NULL DEFAULT 0,
      \`errors\` json,
      \`status\` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
      \`importedBy\` varchar(200),
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`import_logs_id\` PRIMARY KEY(\`id\`)
    )`);
    console.log("[Database] Table 'import_logs' ready");

    await db.execute(sql`CREATE TABLE IF NOT EXISTS \`notifications\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`title\` varchar(200) NOT NULL,
      \`message\` text NOT NULL,
      \`type\` enum('info','success','warning','error') NOT NULL DEFAULT 'info',
      \`isRead\` int NOT NULL DEFAULT 0,
      \`userId\` int,
      \`sectorId\` int,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      CONSTRAINT \`notifications_id\` PRIMARY KEY(\`id\`)
    )`);
    console.log("[Database] Table 'notifications' ready");

    console.log("[Database] All tables initialized successfully!");
  } catch (error) {
    console.error("[Database] Failed to initialize tables:", error);
    throw error;
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== SECTORS =====
export async function getAllSectors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sectors).orderBy(sectors.name);
}

export async function getSectorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sectors).where(eq(sectors.id, id)).limit(1);
  return result[0];
}

export async function getSectorByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sectors).where(eq(sectors.code, code)).limit(1);
  return result[0];
}

export async function createSector(data: InsertSector) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sectors).values(data);
  return result[0].insertId;
}

export async function updateSector(id: number, data: Partial<InsertSector>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sectors).set(data).where(eq(sectors.id, id));
}

export async function deleteSector(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sectors).where(eq(sectors.id, id));
}

export async function assignUserToSector(userId: number, sectorId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ sectorId }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

// ===== UNITS =====
export async function getAllUnits(filters?: { type?: string; status?: string; search?: string; sectorId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.type && filters.type !== 'all') conditions.push(eq(units.type, filters.type as any));
  if (filters?.status && filters.status !== 'all') conditions.push(eq(units.status, filters.status as any));
  if (filters?.search) {
    conditions.push(or(
      like(units.code, `%${filters.search}%`), 
      like(units.name, `%${filters.search}%`),
      like(units.ownerName, `%${filters.search}%`),
      like(units.buildingName, `%${filters.search}%`)
    ));
  }
  if (filters?.sectorId) conditions.push(eq(units.sectorId, filters.sectorId));
  if (conditions.length > 0) return db.select().from(units).where(and(...conditions)).orderBy(units.code);
  return db.select().from(units).orderBy(units.code);
}

export async function getDetailedUnitsReport() {
  const db = await getDb();
  if (!db) return [];
  
  const allUnits = await db.select().from(units).orderBy(units.code);
  const sectorList = await getAllSectors();
  const sectorMap = new Map(sectorList.map(s => [s.id, s.name]));
  
  const report = [];
  
  for (const unit of allUnits) {
    const egyptians = await db.select().from(egyptianResidents).where(eq(egyptianResidents.unitId, unit.id));
    const russians = await db.select().from(russianResidents).where(eq(russianResidents.unitId, unit.id));
    
    // Get past residents from occupancy records
    const pastRecords = await db.select().from(occupancyRecords)
      .where(and(eq(occupancyRecords.unitId, unit.id), eq(occupancyRecords.action, "check_out")))
      .orderBy(desc(occupancyRecords.actionDate));

    report.push({
      ...unit,
      sectorName: sectorMap.get(unit.sectorId || 0) || "غير محدد",
      residents: [
        ...egyptians.map(r => ({ ...r, type: "egyptian" })),
        ...russians.map(r => ({ ...r, type: "russian" }))
      ],
      pastResidents: pastRecords
    });
  }
  
  return report;
}

export async function getFullResidentHistory() {
  const db = await getDb();
  if (!db) return [];
  
  const allUnits = await db.select().from(units);
  const unitMap = new Map(allUnits.map(u => [u.id, u.code]));
  
  const egyptians = await db.select().from(egyptianResidents);
  const russians = await db.select().from(russianResidents);
  
  const history = [];
  
  for (const r of egyptians) {
    history.push({
      unitCode: r.unitId ? unitMap.get(r.unitId) || "غير معروف" : "غير مسكن حالياً",
      name: r.name,
      idNumber: r.nationalId,
      phone: r.phone || "بدون هاتف",
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      status: r.status
    });
  }
  
  for (const r of russians) {
    history.push({
      unitCode: r.unitId ? unitMap.get(r.unitId) || "غير معروف" : "غير مسكن حالياً",
      name: r.name,
      idNumber: r.passportNumber,
      phone: r.phone || "بدون هاتف",
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      status: r.status
    });
  }
  
  return history;
}

export async function getOccupancyStatsReport() {
  const db = await getDb();
  if (!db) return [];
  
  const allUnits = await db.select().from(units).orderBy(units.code);
  return allUnits.map(u => ({
    unitCode: u.code,
    buildingName: u.buildingName || "غير محدد",
    totalBeds: u.beds,
    occupiedBeds: u.currentOccupants,
    vacantBeds: u.beds - u.currentOccupants,
    status: u.status
  }));
}

export async function getUnitById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(units).where(eq(units.id, id)).limit(1);
  return result[0];
}

export async function getUnitByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(units).where(eq(units.code, code)).limit(1);
  return result[0];
}

export async function createUnit(data: InsertUnit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(units).values(data);
}

export async function updateUnit(id: number, data: Partial<InsertUnit>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(units).set(data).where(eq(units.id, id));
}

export async function deleteUnit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(units).where(eq(units.id, id));
}

// ===== EGYPTIAN RESIDENTS =====
export async function getAllEgyptianResidents(filters?: { status?: string; unitId?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status && filters.status !== 'all') conditions.push(eq(egyptianResidents.status, filters.status as any));
  if (filters?.unitId) conditions.push(eq(egyptianResidents.unitId, filters.unitId));
  if (filters?.search) conditions.push(or(like(egyptianResidents.name, `%${filters.search}%`), like(egyptianResidents.nationalId, `%${filters.search}%`)));
  if (conditions.length > 0) return db.select().from(egyptianResidents).where(and(...conditions)).orderBy(desc(egyptianResidents.createdAt));
  return db.select().from(egyptianResidents).orderBy(desc(egyptianResidents.createdAt));
}

export async function getEgyptianResidentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(egyptianResidents).where(eq(egyptianResidents.id, id)).limit(1);
  return result[0];
}

export async function createEgyptianResident(data: InsertEgyptianResident) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(egyptianResidents).values(data);
  return result[0].insertId;
}

export async function updateEgyptianResident(id: number, data: Partial<InsertEgyptianResident>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(egyptianResidents).set(data).where(eq(egyptianResidents.id, id));
}

export async function getEgyptianResidentsByUnitId(unitId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(egyptianResidents).where(and(eq(egyptianResidents.unitId, unitId), eq(egyptianResidents.status, "active")));
}

// ===== RUSSIAN RESIDENTS =====
export async function getAllRussianResidents(filters?: { status?: string; unitId?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status && filters.status !== 'all') conditions.push(eq(russianResidents.status, filters.status as any));
  if (filters?.unitId) conditions.push(eq(russianResidents.unitId, filters.unitId));
  if (filters?.search) conditions.push(or(like(russianResidents.name, `%${filters.search}%`), like(russianResidents.passportNumber, `%${filters.search}%`)));
  if (conditions.length > 0) return db.select().from(russianResidents).where(and(...conditions)).orderBy(desc(russianResidents.createdAt));
  return db.select().from(russianResidents).orderBy(desc(russianResidents.createdAt));
}

export async function getRussianResidentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(russianResidents).where(eq(russianResidents.id, id)).limit(1);
  return result[0];
}

export async function createRussianResident(data: InsertRussianResident) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(russianResidents).values(data);
  return result[0].insertId;
}

export async function updateRussianResident(id: number, data: Partial<InsertRussianResident>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(russianResidents).set(data).where(eq(russianResidents.id, id));
}

export async function getRussianResidentsByUnitId(unitId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(russianResidents).where(and(eq(russianResidents.unitId, unitId), eq(russianResidents.status, "active")));
}

// ===== FIND RESIDENTS BY DOCUMENT =====
export async function findEgyptianByNationalId(nationalId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.nationalId, nationalId), eq(egyptianResidents.status, "active"))).limit(1);
  return result[0];
}

export async function findRussianByPassport(passportNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(russianResidents).where(and(eq(russianResidents.passportNumber, passportNumber), eq(russianResidents.status, "active"))).limit(1);
  return result[0];
}

export async function findEgyptianByNameAndUnit(name: string, unitId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.name, name), eq(egyptianResidents.unitId, unitId), eq(egyptianResidents.status, "active"))).limit(1);
  return result[0];
}

export async function findRussianByNameAndUnit(name: string, unitId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(russianResidents).where(and(eq(russianResidents.name, name), eq(russianResidents.unitId, unitId), eq(russianResidents.status, "active"))).limit(1);
  return result[0];
}

// ===== OCCUPANCY RECORDS =====
export async function createOccupancyRecord(data: InsertOccupancyRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(occupancyRecords).values(data);
}

export async function getRecentOccupancyRecords(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(occupancyRecords).orderBy(desc(occupancyRecords.createdAt)).limit(limit);
}

export async function getAllOccupancyRecords() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(occupancyRecords).orderBy(desc(occupancyRecords.createdAt));
}

// ===== IMPORT LOGS =====
export async function createImportLog(data: InsertImportLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(importLogs).values(data);
  return result[0].insertId;
}

export async function updateImportLog(id: number, data: Partial<InsertImportLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(importLogs).set(data).where(eq(importLogs.id, id));
}

export async function getAllImportLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importLogs).orderBy(desc(importLogs.createdAt));
}

// ===== NOTIFICATIONS =====
export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(data);
}

export async function getUnreadNotifications(sectorId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notifications.isRead, 0)];
  if (sectorId) {
    conditions.push(or(eq(notifications.sectorId, sectorId), sql`${notifications.sectorId} IS NULL`) as any);
  }
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function getAllNotifications(sectorId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (sectorId) {
    return db.select().from(notifications).where(or(eq(notifications.sectorId, sectorId), sql`${notifications.sectorId} IS NULL`)).orderBy(desc(notifications.createdAt)).limit(100);
  }
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
}

export async function markAllNotificationsRead(sectorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (sectorId) {
    await db.update(notifications).set({ isRead: 1 }).where(and(eq(notifications.isRead, 0), or(eq(notifications.sectorId, sectorId), sql`${notifications.sectorId} IS NULL`)));
  } else {
    await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.isRead, 0));
  }
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, id));
}

// ===== DASHBOARD STATS =====
export async function getDashboardStats(sectorId?: number) {
  const db = await getDb();
  if (!db) return { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, maintenanceUnits: 0, totalEgyptian: 0, totalRussian: 0, totalApartments: 0, totalChalets: 0, occupiedApartments: 0, occupiedChalets: 0 };

  let allUnitsData;
  if (sectorId) {
    allUnitsData = await db.select().from(units).where(eq(units.sectorId, sectorId));
  } else {
    allUnitsData = await db.select().from(units);
  }

  // Get unit IDs for this sector to filter residents
  const unitIds = allUnitsData.map(u => u.id);

  let activeEgyptians: any[] = [];
  let activeRussians: any[] = [];
  if (unitIds.length > 0) {
    activeEgyptians = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.status, "active"), inArray(egyptianResidents.unitId, unitIds)));
    activeRussians = await db.select().from(russianResidents).where(and(eq(russianResidents.status, "active"), inArray(russianResidents.unitId, unitIds)));
  } else if (!sectorId) {
    activeEgyptians = await db.select().from(egyptianResidents).where(eq(egyptianResidents.status, "active"));
    activeRussians = await db.select().from(russianResidents).where(eq(russianResidents.status, "active"));
  }

  const totalUnits = allUnitsData.length;
  const occupiedUnits = allUnitsData.filter(u => u.status === "occupied").length;
  const vacantUnits = allUnitsData.filter(u => u.status === "vacant").length;
  const maintenanceUnits = allUnitsData.filter(u => u.status === "maintenance").length;
  const totalApartments = allUnitsData.filter(u => u.type === "apartment").length;
  const totalChalets = allUnitsData.filter(u => u.type === "chalet").length;
  const occupiedApartments = allUnitsData.filter(u => u.type === "apartment" && u.status === "occupied").length;
  const occupiedChalets = allUnitsData.filter(u => u.type === "chalet" && u.status === "occupied").length;

  return {
    totalUnits,
    occupiedUnits,
    vacantUnits,
    maintenanceUnits,
    totalEgyptian: activeEgyptians.length,
    totalRussian: activeRussians.length,
    totalApartments,
    totalChalets,
    occupiedApartments,
    occupiedChalets,
  };
}

// ===== SEED DATA =====
export async function seedUnits() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(units).limit(1);
  if (existing.length > 0) return;

  const seedData: InsertUnit[] = [];
  // Apartments (A-101 to A-320) - 3 buildings, each 10 floors, 2 apartments per floor
  for (let building = 1; building <= 3; building++) {
    for (let floor = 1; floor <= 10; floor++) {
      for (let apt = 1; apt <= 2; apt++) {
        const code = `A-${building}${String(floor).padStart(2, '0')}${apt}`;
        seedData.push({
          code,
          name: `شقة ${code}`,
          type: "apartment",
          floor: `${floor}`,
          rooms: floor <= 5 ? 2 : 3,
          beds: floor <= 5 ? 4 : 6,
          status: "vacant",
          currentOccupants: 0,
        });
      }
    }
  }

  // Chalets (C-01 to C-20)
  for (let i = 1; i <= 20; i++) {
    const code = `C-${String(i).padStart(2, '0')}`;
    seedData.push({
      code,
      name: `شاليه ${code}`,
      type: "chalet",
      floor: "أرضي",
      rooms: i <= 10 ? 3 : 4,
      beds: i <= 10 ? 6 : 8,
      status: "vacant",
      currentOccupants: 0,
    });
  }

  await db.insert(units).values(seedData);
}

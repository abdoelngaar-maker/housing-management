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
import { sql, eq, and, or, desc, asc, inArray, like } from "drizzle-orm";

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

    // Migration for existing units table
    try {
      const columns: any = await db.execute(sql`SHOW COLUMNS FROM \`units\``);
      const columnNames = columns[0].map((c: any) => c.Field);
      
      if (!columnNames.includes('ownerName')) {
        await db.execute(sql`ALTER TABLE \`units\` ADD COLUMN \`ownerName\` varchar(255)`);
      }
      if (!columnNames.includes('buildingName')) {
        await db.execute(sql`ALTER TABLE \`units\` ADD COLUMN \`buildingName\` varchar(255)`);
      }
    } catch (e) {
      console.warn("[Database] Migration error:", e);
    }

    console.log("[Database] All tables ready");
  } catch (error) {
    console.error("[Database] Initialization failed:", error);
  }
}

// ===== USERS =====
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function upsertUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await db.update(users).set({
      ...data,
      lastSignedIn: new Date(),
    }).where(eq(users.openId, data.openId));
    return existing.id;
  } else {
    const result = await db.insert(users).values(data);
    return result[0].insertId;
  }
}

// ===== SECTORS =====
export async function getAllSectors() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sectors).orderBy(asc(sectors.name));
}

export async function createSector(data: InsertSector) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sectors).values(data);
  return result[0].insertId;
}

// ===== UNITS =====
export async function getAllUnits(sectorId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (sectorId) {
    return db.select().from(units).where(eq(units.sectorId, sectorId)).orderBy(asc(units.code));
  }
  return db.select().from(units).orderBy(asc(units.code));
}

export async function getUnitById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(units).where(eq(units.id, id)).limit(1);
  return result[0];
}

export async function createUnit(data: InsertUnit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(units).values(data);
  return result[0].insertId;
}

export async function updateUnit(id: number, data: Partial<InsertUnit>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(units).set(data).where(eq(units.id, id));
}

export async function deleteUnit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only allow deleting vacant units for safety
  const unit = await getUnitById(id);
  if (unit && unit.currentOccupants > 0) {
    throw new Error("لا يمكن حذف وحدة مسكونة حالياً");
  }
  await db.delete(units).where(eq(units.id, id));
}

// ===== RESIDENTS =====
export async function createEgyptianResident(data: InsertEgyptianResident) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(egyptianResidents).values(data);
  
  // Update unit status
  await db.execute(sql`UPDATE \`units\` SET \`status\` = 'occupied', \`currentOccupants\` = \`currentOccupants\` + 1 WHERE \`id\` = ${data.unitId}`);
  
  return result[0].insertId;
}

export async function createRussianResident(data: InsertRussianResident) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(russianResidents).values(data);
  
  // Update unit status
  await db.execute(sql`UPDATE \`units\` SET \`status\` = 'occupied', \`currentOccupants\` = \`currentOccupants\` + 1 WHERE \`id\` = ${data.unitId}`);
  
  return result[0].insertId;
}

export async function checkoutResident(type: 'egyptian' | 'russian', id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let unitId: number | null = null;
  let residentName = "";

  if (type === 'egyptian') {
    const resident = await db.select().from(egyptianResidents).where(eq(egyptianResidents.id, id)).limit(1);
    if (resident[0]) {
      unitId = resident[0].unitId;
      residentName = resident[0].name;
      await db.update(egyptianResidents).set({ status: 'checked_out', checkOutDate: new Date() }).where(eq(egyptianResidents.id, id));
    }
  } else {
    const resident = await db.select().from(russianResidents).where(eq(russianResidents.id, id)).limit(1);
    if (resident[0]) {
      unitId = resident[0].unitId;
      residentName = resident[0].name;
      await db.update(russianResidents).set({ status: 'checked_out', checkOutDate: new Date() }).where(eq(russianResidents.id, id));
    }
  }

  if (unitId) {
    await db.execute(sql`UPDATE \`units\` SET \`currentOccupants\` = GREATEST(0, \`currentOccupants\` - 1) WHERE \`id\` = ${unitId}`);
    const updatedUnit = await getUnitById(unitId);
    if (updatedUnit && updatedUnit.currentOccupants === 0) {
      await db.update(units).set({ status: 'vacant' }).where(eq(units.id, unitId));
    }
    
    // Create occupancy record for history
    await createOccupancyRecord({
      unitId,
      residentName,
      action: 'check_out',
      actionDate: new Date(),
    });
  }
}

export async function getActiveResidentsByUnit(unitId: number) {
  const db = await getDb();
  if (!db) return { egyptians: [], russians: [] };
  
  const egyptians = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.unitId, unitId), eq(egyptianResidents.status, "active")));
  const russians = await db.select().from(russianResidents).where(and(eq(russianResidents.unitId, unitId), eq(russianResidents.status, "active")));
  
  return { egyptians, russians };
}

// ===== REPORT FUNCTIONS (UNIFIED NAMES) =====

export async function getFullResidentHistoryReport() {
  const db = await getDb();
  if (!db) return [];
  
  const egyptians = await db.select().from(egyptianResidents);
  const russians = await db.select().from(russianResidents);
  const allUnits = await db.select().from(units);
  
  const unitMap = new Map(allUnits.map(u => [u.id, u.code]));
  
  const history = [
    ...egyptians.map(r => ({
      name: r.name,
      idNumber: r.nationalId,
      phone: r.phone,
      unitCode: unitMap.get(r.unitId) || "Unknown",
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      type: 'egyptian'
    })),
    ...russians.map(r => ({
      name: r.name,
      idNumber: r.passportNumber,
      phone: r.phone,
      unitCode: unitMap.get(r.unitId) || "Unknown",
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      type: 'russian'
    }))
  ];
  
  return history.sort((a, b) => Number(b.checkInDate) - Number(a.checkInDate));
}

export async function getOccupancyStatsReport() {
  const db = await getDb();
  if (!db) return [];
  
  const allUnits = await db.select().from(units);
  return allUnits.map(u => ({
    unitCode: u.code,
    buildingName: u.buildingName || "-",
    totalBeds: u.beds,
    occupiedBeds: u.currentOccupants,
    vacantBeds: Math.max(0, u.beds - u.currentOccupants),
    status: u.status
  }));
}

export async function getDetailedUnitReportData() {
  const db = await getDb();
  if (!db) return [];
  
  const allUnits = await db.select().from(units);
  const egyptians = await db.select().from(egyptianResidents).where(eq(egyptianResidents.status, "active"));
  const russians = await db.select().from(russianResidents).where(eq(russianResidents.status, "active"));
  const pastRecords = await db.select().from(occupancyRecords).where(eq(occupancyRecords.action, "check_out"));
  
  return allUnits.map(u => ({
    ...u,
    residents: [
      ...egyptians.filter(r => r.unitId === u.id).map(r => ({ ...r, type: 'egyptian' })),
      ...russians.filter(r => r.unitId === u.id).map(r => ({ ...r, type: 'russian' }))
    ],
    pastResidents: pastRecords.filter(r => r.unitId === u.id)
  }));
}

// ===== OCCUPANCY RECORDS =====
export async function createOccupancyRecord(data: InsertOccupancyRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(occupancyRecords).values(data);
}

// ===== SEED DATA =====
export async function seedUnits() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(units).limit(1);
  if (existing.length > 0) return;
  // (Omitted seed logic for brevity, keeping existing units)
}

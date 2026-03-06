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
  const dbUrl = ENV.databaseUrl || process.env.DATABASE_URL;
  
  if (!_db && dbUrl) {
    try {
      console.log("[Database] Attempting to connect with SSL flexible settings...");
      _db = drizzle(dbUrl, { 
        connection: {
          ssl: {
            rejectUnauthorized: false
          }
        }
      } as any);
      console.log("[Database] Connection initialized successfully");
    } catch (error) {
      console.error("[Database] Critical Connection Error:", error);
      _db = null;
    }
  }
  return _db;
}

export async function initializeDatabase() {
  const db = await getDb();
  if (!db) return;
  const executeSafe = async (name: string, query: any) => {
    try { await db.execute(query); } catch (e: any) { console.log(`[Database] Table ${name} status checked`); }
  };
  try {
    await executeSafe("users", sql`CREATE TABLE IF NOT EXISTS users (id int AUTO_INCREMENT PRIMARY KEY, openId varchar(64) NOT NULL UNIQUE, name text, email varchar(320), loginMethod varchar(64), role enum('user','admin') NOT NULL DEFAULT 'user', sectorId int, createdAt timestamp DEFAULT CURRENT_TIMESTAMP, updatedAt timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, lastSignedIn timestamp DEFAULT CURRENT_TIMESTAMP)`);
  } catch (error) {}
}

// ===== USER FUNCTIONS =====
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select().from(users).where(eq(users.id, id));
  return results[0] || null;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select().from(users).where(eq(users.openId, openId));
  return results[0] || null;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select().from(users).where(eq(users.email, email));
  return results[0] || null;
}

export async function upsertUser(user: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getUserByOpenId(user.openId);
  if (existing) {
    await db.update(users).set({ ...user, updatedAt: new Date(), lastSignedIn: new Date() }).where(eq(users.openId, user.openId));
    return await getUserByOpenId(user.openId);
  } else {
    await db.insert(users).values(user);
    return await getUserByOpenId(user.openId);
  }
}

// ===== SECTOR FUNCTIONS =====
export async function getAllSectors() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sectors).orderBy(asc(sectors.name));
}

export async function createSector(sector: InsertSector) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(sectors).values(sector);
  const results = await db.select().from(sectors).where(eq(sectors.name, sector.name));
  return results[0];
}

// ===== UNIT FUNCTIONS =====
export async function getAllUnits(sectorId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (sectorId) {
    return await db.select().from(units).where(eq(units.sectorId, sectorId)).orderBy(asc(units.code));
  }
  return await db.select().from(units).orderBy(asc(units.code));
}

export async function getUnitById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select().from(units).where(eq(units.id, id));
  return results[0] || null;
}

export async function createUnit(unit: InsertUnit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(units).values(unit);
  const results = await db.select().from(units).where(eq(units.code, unit.code));
  return results[0];
}

export async function updateUnit(id: number, unit: Partial<InsertUnit>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(units).set({ ...unit, updatedAt: new Date() }).where(eq(units.id, id));
  return await getUnitById(id);
}

export async function deleteUnit(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(occupancyRecords).where(eq(occupancyRecords.unitId, id));
  await db.delete(egyptianResidents).where(eq(egyptianResidents.unitId, id));
  await db.delete(russianResidents).where(eq(russianResidents.unitId, id));
  await db.delete(units).where(eq(units.id, id));
  return true;
}

// ===== RESIDENT FUNCTIONS =====
export async function createEgyptianResident(resident: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const insertData: any = {
    name: resident.name,
    nationalId: resident.nationalId || resident.idNumber,
    phone: resident.phone || null,
    unitId: resident.unitId,
    checkInDate: typeof resident.checkInDate === 'number' ? resident.checkInDate : Date.now(),
    status: resident.status || "active",
  };
  await db.insert(egyptianResidents).values(insertData);
  const unit = await getUnitById(resident.unitId);
  if (unit) {
    await db.insert(occupancyRecords).values({ residentType: "egyptian", residentId: 0, residentName: resident.name, unitId: resident.unitId, unitCode: unit.code, action: "check_in", actionDate: Date.now() });
    await updateUnit(resident.unitId, { currentOccupants: unit.currentOccupants + 1, status: "occupied" });
  }
  return { success: true };
}

export async function createRussianResident(resident: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const insertData: any = {
    name: resident.name,
    passportNumber: resident.passportNumber,
    gender: resident.gender,
    unitId: resident.unitId,
    checkInDate: typeof resident.checkInDate === 'number' ? resident.checkInDate : Date.now(),
    status: resident.status || "active",
  };
  await db.insert(russianResidents).values(insertData);
  const unit = await getUnitById(resident.unitId);
  if (unit) {
    await db.insert(occupancyRecords).values({ residentType: "russian", residentId: 0, residentName: resident.name, unitId: resident.unitId, unitCode: unit.code, action: "check_in", actionDate: Date.now() });
    await updateUnit(resident.unitId, { currentOccupants: unit.currentOccupants + 1, status: "occupied" });
  }
  return { success: true };
}

export async function getEgyptianResidentByIdNumber(idNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select().from(egyptianResidents).where(eq(egyptianResidents.nationalId, idNumber));
  return results[0] || null;
}

export async function getRussianResidentByPassportNumber(passportNumber: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select().from(russianResidents).where(eq(russianResidents.passportNumber, passportNumber));
  return results[0] || null;
}

export async function checkoutResident(type: "egyptian" | "russian", id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let residentName = ""; let unitId = 0;
  if (type === "egyptian") {
    const results = await db.select().from(egyptianResidents).where(eq(egyptianResidents.id, id));
    if (results[0]) { residentName = results[0].name; unitId = results[0].unitId || 0;
      await db.update(egyptianResidents).set({ status: "checked_out", checkOutDate: Date.now(), updatedAt: new Date() }).where(eq(egyptianResidents.id, id)); }
  } else {
    const results = await db.select().from(russianResidents).where(eq(russianResidents.id, id));
    if (results[0]) { residentName = results[0].name; unitId = results[0].unitId || 0;
      await db.update(russianResidents).set({ status: "checked_out", checkOutDate: Date.now(), updatedAt: new Date() }).where(eq(russianResidents.id, id)); }
  }
  if (unitId > 0) {
    const unit = await getUnitById(unitId);
    if (unit) {
      const newCount = Math.max(0, unit.currentOccupants - 1);
      await updateUnit(unitId, { currentOccupants: newCount, status: newCount === 0 ? "vacant" : "occupied" });
      await db.insert(occupancyRecords).values({ residentType: type, residentId: id, residentName, unitId, unitCode: unit.code, action: "check_out", actionDate: Date.now() });
    }
  }
  return true;
}

// ===== REPORT FUNCTIONS =====
export async function getOccupancyStatsReport() {
  const db = await getDb();
  if (!db) return [];
  const allUnits = await db.select().from(units);
  return [
    { name: "Occupied", value: allUnits.filter(u => u.status === "occupied").length },
    { name: "Vacant", value: allUnits.filter(u => u.status === "vacant").length },
    { name: "Maintenance", value: allUnits.filter(u => u.status === "maintenance").length },
  ];
}

export async function getFullResidentHistoryReport() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(occupancyRecords).orderBy(desc(occupancyRecords.actionDate));
}

export async function getDetailedUnitReportData() {
  const db = await getDb();
  if (!db) return [];
  try {
    const allUnits = await db.select().from(units).orderBy(asc(units.code));
    const allSectors = await db.select().from(sectors);
    const activeEgyptians = await db.select().from(egyptianResidents).where(eq(egyptianResidents.status, "active"));
    const activeRussians = await db.select().from(russianResidents).where(eq(russianResidents.status, "active"));
    const pastRecords = await db.select().from(occupancyRecords).where(eq(occupancyRecords.action, "check_out")).orderBy(desc(occupancyRecords.actionDate));
    return allUnits.map(unit => {
      const sector = allSectors.find(s => s.id === unit.sectorId);
      const currentEgyptians = activeEgyptians.filter(r => r.unitId === unit.id).map(r => ({ id: r.id, name: r.name, nationalId: r.nationalId, phone: r.phone, checkInDate: r.checkInDate, type: "egyptian" as const }));
      const currentRussians = activeRussians.filter(r => r.unitId === unit.id).map(r => ({ id: r.id, name: r.name, passportNumber: r.passportNumber, phone: r.phone, checkInDate: r.checkInDate, type: "russian" as const }));
      const unitPastRecords = pastRecords.filter(r => r.unitId === unit.id).map(r => ({ id: r.id, residentName: r.residentName, actionDate: r.actionDate, residentType: r.residentType }));
      return { ...unit, sectorName: sector?.name || "\u0628\u062f\u0648\u0646 \u0642\u0637\u0627\u0639", residents: [...currentEgyptians, ...currentRussians], pastResidents: unitPastRecords };
    });
  } catch (error: any) {
    console.error("[Database] Error in getDetailedUnitReportData:", error);
    return [];
  }
}

// ===== DASHBOARD STATS =====
export async function getDashboardStats(sectorId?: number) {
  const db = await getDb();
  if (!db) return { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, maintenanceUnits: 0, totalEgyptianResidents: 0, totalRussianResidents: 0, totalResidents: 0, occupancyRate: 0 };
  try {
    let allUnits;
    if (sectorId) { allUnits = await db.select().from(units).where(eq(units.sectorId, sectorId)); }
    else { allUnits = await db.select().from(units); }
    const activeEgyptians = await db.select().from(egyptianResidents).where(eq(egyptianResidents.status, "active"));
    const activeRussians = await db.select().from(russianResidents).where(eq(russianResidents.status, "active"));
    let filteredEgyptians = activeEgyptians; let filteredRussians = activeRussians;
    if (sectorId) {
      const unitIds = allUnits.map(u => u.id);
      filteredEgyptians = activeEgyptians.filter(r => r.unitId && unitIds.includes(r.unitId));
      filteredRussians = activeRussians.filter(r => r.unitId && unitIds.includes(r.unitId));
    }
    const totalUnits = allUnits.length;
    const occupiedUnits = allUnits.filter(u => u.status === "occupied").length;
    const vacantUnits = allUnits.filter(u => u.status === "vacant").length;
    const maintenanceUnits = allUnits.filter(u => u.status === "maintenance").length;
    const totalEgyptianResidents = filteredEgyptians.length;
    const totalRussianResidents = filteredRussians.length;
    const totalResidents = totalEgyptianResidents + totalRussianResidents;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    return { totalUnits, occupiedUnits, vacantUnits, maintenanceUnits, totalEgyptianResidents, totalRussianResidents, totalResidents, occupancyRate };
  } catch (error: any) {
    console.error("[Database] Error in getDashboardStats:", error);
    return { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, maintenanceUnits: 0, totalEgyptianResidents: 0, totalRussianResidents: 0, totalResidents: 0, occupancyRate: 0 };
  }
}

// ===== NOTIFICATION FUNCTIONS =====
export async function getNotifications(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (userId) { return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)); }
  return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
}

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notifications).values(notification);
  return { success: true };
}

export async function markNotificationAsRead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  return true;
}

// ===== IMPORT LOG FUNCTIONS =====
export async function createImportLog(log: InsertImportLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(importLogs).values(log);
  return { success: true };
}

export async function getImportLogs() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(importLogs).orderBy(desc(importLogs.createdAt));
}


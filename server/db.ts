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

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(asc(users.id));
}

// ===== SECTOR FUNCTIONS =====
export async function getAllSectors() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sectors).orderBy(asc(sectors.name));
}

export async function getSectorById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db.select().from(sectors).where(eq(sectors.id, id));
  return results[0] || null;
}

export async function createSector(sector: InsertSector) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(sectors).values(sector);
  const results = await db.select().from(sectors).where(eq(sectors.name, sector.name));
  return results[0];
}

export async function updateSector(id: number, data: Partial<InsertSector>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sectors).set({ ...data, updatedAt: new Date() }).where(eq(sectors.id, id));
  return await getSectorById(id);
}

export async function deleteSector(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sectors).where(eq(sectors.id, id));
  return true;
}

export async function assignUserToSector(userId: number, sectorId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ sectorId, updatedAt: new Date() }).where(eq(users.id, userId));
  return true;
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

export async function getUnitByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(units).where(eq(units.code, code));
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

export async function getUnitResidents(unitId: number) {
  const db = await getDb();
  if (!db) return { egyptians: [], russians: [] };
  const egyp = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.unitId, unitId), eq(egyptianResidents.status, "active")));
  const russ = await db.select().from(russianResidents).where(and(eq(russianResidents.unitId, unitId), eq(russianResidents.status, "active")));
  return { egyptians: egyp, russians: russ };
}

export async function seedUnits() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(units);
  if (existing.length > 0) return { created: 0, message: "Units already exist" };
  const sampleUnits: InsertUnit[] = [];
  for (let i = 1; i <= 10; i++) {
    sampleUnits.push({
      code: `A-${1000 + i}`,
      name: `Ø´ÙØ© ${i}`,
      type: "apartment",
      rooms: 3,
      beds: 6,
      status: "vacant",
      currentOccupants: 0,
    });
  }
  for (let i = 1; i <= 5; i++) {
    sampleUnits.push({
      code: `C-${2000 + i}`,
      name: `Ø´Ø§ÙÙÙ ${i}`,
      type: "chalet",
      rooms: 2,
      beds: 4,
      status: "vacant",
      currentOccupants: 0,
    });
  }
  for (const u of sampleUnits) {
    try { await db.insert(units).values(u); } catch (e) {}
  }
  return { created: sampleUnits.length, message: "Sample units created" };
}

// ===== RESIDENT FUNCTIONS =====
export async function createEgyptianResident(resident: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const insertData: any = {
    name: resident.name,
    nationalId: resident.nationalId || resident.idNumber,
    phone: resident.phone || null,
    shift: resident.shift || null,
    unitId: resident.unitId,
    checkInDate: typeof resident.checkInDate === 'number' ? resident.checkInDate : Date.now(),
    status: resident.status || "active",
    ocrConfidence: resident.ocrConfidence || null,
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
    nationality: resident.nationality || "Russian",
    gender: resident.gender,
    phone: resident.phone || null,
    shift: resident.shift || null,
    unitId: resident.unitId,
    checkInDate: typeof resident.checkInDate === 'number' ? resident.checkInDate : Date.now(),
    status: resident.status || "active",
    ocrConfidence: resident.ocrConfidence || null,
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
    if (results[0]) {
      residentName = results[0].name; unitId = results[0].unitId || 0;
      await db.update(egyptianResidents).set({ status: "checked_out", checkOutDate: Date.now(), updatedAt: new Date() }).where(eq(egyptianResidents.id, id));
    }
  } else {
    const results = await db.select().from(russianResidents).where(eq(russianResidents.id, id));
    if (results[0]) {
      residentName = results[0].name; unitId = results[0].unitId || 0;
      await db.update(russianResidents).set({ status: "checked_out", checkOutDate: Date.now(), updatedAt: new Date() }).where(eq(russianResidents.id, id));
    }
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

export async function checkoutResidentByNationalId(nationalId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const egyResults = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.nationalId, nationalId), eq(egyptianResidents.status, "active")));
  if (egyResults[0]) {
    return await checkoutResident("egyptian", egyResults[0].id);
  }
  const rusResults = await db.select().from(russianResidents).where(and(eq(russianResidents.passportNumber, nationalId), eq(russianResidents.status, "active")));
  if (rusResults[0]) {
    return await checkoutResident("russian", rusResults[0].id);
  }
  return false;
}

// ===== TRANSFER FUNCTIONS =====
export async function transferResidents(residents: { id: number; type: "egyptian" | "russian"; name: string }[], fromUnitId: number, toUnitId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const fromUnit = await getUnitById(fromUnitId);
  const toUnit = await getUnitById(toUnitId);
  if (!fromUnit || !toUnit) throw new Error("Unit not found");
  let transferred = 0;
  for (const r of residents) {
    if (r.type === "egyptian") {
      await db.update(egyptianResidents).set({ unitId: toUnitId, status: "active", updatedAt: new Date() }).where(eq(egyptianResidents.id, r.id));
    } else {
      await db.update(russianResidents).set({ unitId: toUnitId, status: "active", updatedAt: new Date() }).where(eq(russianResidents.id, r.id));
    }
    await db.insert(occupancyRecords).values({ residentType: r.type, residentId: r.id, residentName: r.name, unitId: toUnitId, unitCode: toUnit.code, action: "transfer_in", fromUnitId, fromUnitCode: fromUnit.code, actionDate: Date.now() });
    await db.insert(occupancyRecords).values({ residentType: r.type, residentId: r.id, residentName: r.name, unitId: fromUnitId, unitCode: fromUnit.code, action: "transfer_out", fromUnitId: toUnitId, fromUnitCode: toUnit.code, actionDate: Date.now() });
    transferred++;
  }
  const newFromCount = Math.max(0, fromUnit.currentOccupants - transferred);
  const newToCount = toUnit.currentOccupants + transferred;
  await updateUnit(fromUnitId, { currentOccupants: newFromCount, status: newFromCount === 0 ? "vacant" : "occupied" });
  await updateUnit(toUnitId, { currentOccupants: newToCount, status: "occupied" });
  return { transferred };
}

// ===== BULK CHECK-IN FUNCTIONS =====
export async function bulkCheckInEgyptians(residents: any[], unitId: number, checkInDate: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let successCount = 0;
  for (const r of residents) {
    try {
      await createEgyptianResident({ ...r, unitId, checkInDate, status: "active" });
      successCount++;
    } catch (e) {}
  }
  return { successCount, totalCount: residents.length };
}

export async function bulkCheckInRussians(residents: any[], unitId: number, checkInDate: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let successCount = 0;
  for (const r of residents) {
    try {
      await createRussianResident({ ...r, unitId, checkInDate, status: "active" });
      successCount++;
    } catch (e) {}
  }
  return { successCount, totalCount: residents.length };
}

// ===== IMPORT FUNCTIONS =====
export async function processImport(rows: any[], fileName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let successCount = 0;
  let failedCount = 0;
  const errors: { row: number; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const unit = row.unitCode ? await getUnitByCode(row.unitCode) : null;
      if (!unit) { failedCount++; errors.push({ row: i + 1, error: `Ø§ÙÙØ­Ø¯Ø© ${row.unitCode} ØºÙØ± ÙÙØ¬ÙØ¯Ø©` }); continue; }
      if (unit.currentOccupants >= unit.beds) { failedCount++; errors.push({ row: i + 1, error: `Ø§ÙÙØ­Ø¯Ø© ${row.unitCode} ÙÙØªÙØ¦Ø©` }); continue; }
      const checkInDate = row.checkInDate ? new Date(row.checkInDate).getTime() : Date.now();
      await createEgyptianResident({
        name: row.name,
        nationalId: row.nationalId,
        phone: row.phone || null,
        shift: row.shift || null,
        unitId: unit.id,
        checkInDate,
        status: "active",
      });
      if (row.checkOutDate) {
        const egyResults = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.nationalId, row.nationalId), eq(egyptianResidents.status, "active")));
        if (egyResults[0]) {
          await db.update(egyptianResidents).set({ status: "checked_out", checkOutDate: new Date(row.checkOutDate).getTime(), updatedAt: new Date() }).where(eq(egyptianResidents.id, egyResults[0].id));
          const currentUnit = await getUnitById(unit.id);
          if (currentUnit) {
            const newCount = Math.max(0, currentUnit.currentOccupants - 1);
            await updateUnit(unit.id, { currentOccupants: newCount, status: newCount === 0 ? "vacant" : "occupied" });
          }
        }
      }
      successCount++;
    } catch (e: any) {
      failedCount++;
      errors.push({ row: i + 1, error: e.message || "Ø®Ø·Ø£ ØºÙØ± ÙØ¹Ø±ÙÙ" });
    }
  }
  try {
    await db.insert(importLogs).values({ fileName, totalRows: rows.length, successRows: successCount, failedRows: failedCount, errors: JSON.stringify(errors), status: "completed" });
  } catch (e) {}
  return { successCount, failedCount, errors, totalRows: rows.length };
}

export async function processUnitImport(sectorId: number | undefined, unitsList: any[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let created = 0;
  let skipped = 0;
  for (const u of unitsList) {
    try {
      const existing = await getUnitByCode(u.code);
      if (existing) { skipped++; continue; }
      await db.insert(units).values({
        code: u.code,
        name: u.name,
        type: u.type || "apartment",
        sectorId: sectorId || null,
        floor: u.floor || null,
        rooms: u.rooms || 1,
        beds: u.beds || 1,
        notes: u.notes || null,
        status: "vacant",
        currentOccupants: 0,
      });
      created++;
    } catch (e) { skipped++; }
  }
  return { created, skipped, total: unitsList.length };
}

// ===== EVICTION FUNCTIONS =====
export async function processEviction(rows: any[], fileName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let successCount = 0;
  let failedCount = 0;
  const errors: { row: number; error: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let found = false;
      if (row.nationalId) {
        const egyResults = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.nationalId, row.nationalId), eq(egyptianResidents.status, "active")));
        if (egyResults[0]) {
          await checkoutResident("egyptian", egyResults[0].id);
          found = true;
        }
        if (!found) {
          const rusResults = await db.select().from(russianResidents).where(and(eq(russianResidents.passportNumber, row.nationalId), eq(russianResidents.status, "active")));
          if (rusResults[0]) {
            await checkoutResident("russian", rusResults[0].id);
            found = true;
          }
        }
      }
      if (!found && row.unitCode) {
        const unit = await getUnitByCode(row.unitCode);
        if (unit) {
          const egyInUnit = await db.select().from(egyptianResidents).where(and(eq(egyptianResidents.unitId, unit.id), eq(egyptianResidents.status, "active")));
          for (const r of egyInUnit) {
            if (r.name === row.name || !row.name) {
              await checkoutResident("egyptian", r.id);
              found = true;
              break;
            }
          }
          if (!found) {
            const rusInUnit = await db.select().from(russianResidents).where(and(eq(russianResidents.unitId, unit.id), eq(russianResidents.status, "active")));
            for (const r of rusInUnit) {
              if (r.name === row.name || !row.name) {
                await checkoutResident("russian", r.id);
                found = true;
                break;
              }
            }
          }
        }
      }
      if (found) { successCount++; } else { failedCount++; errors.push({ row: i + 1, error: `ÙÙ ÙØªÙ Ø§ÙØ¹Ø«ÙØ± Ø¹ÙÙ Ø§ÙØ³Ø§ÙÙ: ${row.name || row.nationalId}` }); }
    } catch (e: any) {
      failedCount++;
      errors.push({ row: i + 1, error: e.message || "Ø®Ø·Ø£ ØºÙØ± ÙØ¹Ø±ÙÙ" });
    }
  }
  try {
    await db.insert(importLogs).values({ fileName: `eviction_${fileName}`, totalRows: rows.length, successRows: successCount, failedRows: failedCount, errors: JSON.stringify(errors), status: "completed" });
  } catch (e) {}
  return { successCount, failedCount, errors };
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

export async function getOccupancyReportData() {
  const db = await getDb();
  if (!db) return { records: [] };
  const records = await db.select().from(occupancyRecords).orderBy(desc(occupancyRecords.actionDate));
  return { records };
}

export async function getRecentActivity(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(occupancyRecords).orderBy(desc(occupancyRecords.actionDate)).limit(limit);
}

// ===== DASHBOARD STATS =====
export async function getDashboardStats(sectorId?: number) {
  const db = await getDb();
  if (!db) return { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, maintenanceUnits: 0, totalEgyptianResidents: 0, totalRussianResidents: 0, totalResidents: 0, occupancyRate: 0, totalApartments: 0, occupiedApartments: 0, totalChalets: 0, occupiedChalets: 0, totalEgyptian: 0, totalRussian: 0 };
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
    const totalApartments = allUnits.filter(u => u.type === "apartment").length;
    const occupiedApartments = allUnits.filter(u => u.type === "apartment" && u.status === "occupied").length;
    const totalChalets = allUnits.filter(u => u.type === "chalet").length;
    const occupiedChalets = allUnits.filter(u => u.type === "chalet" && u.status === "occupied").length;
    return {
      totalUnits, occupiedUnits, vacantUnits, maintenanceUnits,
      totalEgyptianResidents, totalRussianResidents, totalResidents, occupancyRate,
      totalApartments, occupiedApartments, totalChalets, occupiedChalets,
      totalEgyptian: totalEgyptianResidents, totalRussian: totalRussianResidents,
    };
  } catch (error: any) {
    console.error("[Database] Error in getDashboardStats:", error);
    return { totalUnits: 0, occupiedUnits: 0, vacantUnits: 0, maintenanceUnits: 0, totalEgyptianResidents: 0, totalRussianResidents: 0, totalResidents: 0, occupancyRate: 0, totalApartments: 0, occupiedApartments: 0, totalChalets: 0, occupiedChalets: 0, totalEgyptian: 0, totalRussian: 0 };
  }
}

// ===== NOTIFICATION FUNCTIONS =====
export async function getNotifications(sectorId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (sectorId) {
    return await db.select().from(notifications).where(or(eq(notifications.sectorId, sectorId), eq(notifications.sectorId, 0))).orderBy(desc(notifications.createdAt));
  }
  return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
}

export async function getUnreadNotificationCount(sectorId?: number) {
  const db = await getDb();
  if (!db) return 0;
  let all;
  if (sectorId) {
    all = await db.select().from(notifications).where(and(eq(notifications.isRead, 0), or(eq(notifications.sectorId, sectorId), eq(notifications.sectorId, 0))));
  } else {
    all = await db.select().from(notifications).where(eq(notifications.isRead, 0));
  }
  return all.length;
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
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, id));
  return true;
}

export async function markAllNotificationsAsRead(sectorId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (sectorId) {
    await db.update(notifications).set({ isRead: 1 }).where(or(eq(notifications.sectorId, sectorId), eq(notifications.sectorId, 0)));
  } else {
    await db.update(notifications).set({ isRead: 1 });
  }
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

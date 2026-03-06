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
    try {
      await db.execute(query);
    } catch (e: any) {
      console.log(`[Database] Table ${name} status checked`);
    }
  };

  try {
    await executeSafe("users", sql`CREATE TABLE IF NOT EXISTS \`users\` (
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
  } catch (error) {}
}

export const db = {
  async getUserById(id: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const results = await db.select().from(users).where(eq(users.id, id));
    return results[0] || null;
  },
  async getUserByOpenId(openId: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const results = await db.select().from(users).where(eq(users.openId, openId));
    return results[0] || null;
  },
  async getUserByEmail(email: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const results = await db.select().from(users).where(eq(users.email, email));
    return results[0] || null;
  },
  async upsertUser(user: InsertUser) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const existing = await this.getUserByOpenId(user.openId);
    if (existing) {
      await db.update(users).set({ ...user, updatedAt: new Date(), lastSignedIn: new Date() }).where(eq(users.openId, user.openId));
      return await this.getUserByOpenId(user.openId);
    } else {
      await db.insert(users).values(user);
      return await this.getUserByOpenId(user.openId);
    }
  },
  async getAllSectors() {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(sectors).orderBy(asc(sectors.name));
  },
  async createSector(sector: InsertSector) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(sectors).values(sector);
    const results = await db.select().from(sectors).where(eq(sectors.name, sector.name));
    return results[0];
  },
  async getAllUnits(sectorId?: number) {
    const db = await getDb();
    if (!db) return [];
    let query = db.select().from(units);
    if (sectorId) {
      query = query.where(eq(units.sectorId, sectorId));
    }
    return await query.orderBy(asc(units.code));
  },
  async getUnitById(id: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const results = await db.select().from(units).where(eq(units.id, id));
    return results[0] || null;
  },
  async createUnit(unit: InsertUnit) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(units).values(unit);
    const results = await db.select().from(units).where(eq(units.code, unit.code));
    return results[0];
  },
  async updateUnit(id: number, unit: Partial<InsertUnit>) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.update(units).set({ ...unit, updatedAt: new Date() }).where(eq(units.id, id));
    return await this.getUnitById(id);
  },
  async createEgyptianResident(resident: InsertEgyptianResident) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(egyptianResidents).values(resident);
    const results = await db.select().from(egyptianResidents).where(eq(egyptianResidents.idNumber, resident.idNumber));
    return results[0];
  },
  async createRussianResident(resident: InsertRussianResident) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(russianResidents).values(resident);
    const results = await db.select().from(russianResidents).where(eq(russianResidents.passportNumber, resident.passportNumber));
    return results[0];
  },
  async getEgyptianResidentByIdNumber(idNumber: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const results = await db.select().from(egyptianResidents).where(eq(egyptianResidents.idNumber, idNumber));
    return results[0] || null;
  },
  async getRussianResidentByPassportNumber(passportNumber: string) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const results = await db.select().from(russianResidents).where(eq(russianResidents.passportNumber, passportNumber));
    return results[0] || null;
  },
  async checkInResident(record: InsertOccupancyRecord) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.insert(occupancyRecords).values(record);
    const unit = await this.getUnitById(record.unitId);
    if (unit) {
      await this.updateUnit(record.unitId, { currentOccupants: unit.currentOccupants + 1, status: 'occupied' });
    }
    return true;
  },
  async checkOutResident(type: 'egyptian' | 'russian', id: number) {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const records = await db.select().from(occupancyRecords).where(and(eq(occupancyRecords.residentType, type), eq(occupancyRecords.residentId, id), eq(occupancyRecords.status, 'active')));
    if (records.length > 0) {
      const record = records[0];
      await db.update(occupancyRecords).set({ status: 'completed', checkOutDate: new Date(), updatedAt: new Date() }).where(eq(occupancyRecords.id, record.id));
      const unit = await this.getUnitById(record.unitId);
      if (unit) {
        const newCount = Math.max(0, unit.currentOccupants - 1);
        await this.updateUnit(record.unitId, { currentOccupants: newCount, status: newCount === 0 ? 'vacant' : 'occupied' });
      }
    }
    return true;
  },
  async getOccupancyStatsReport() {
    const db = await getDb();
    if (!db) return [];
    const allUnits = await db.select().from(units);
    return [
      { name: 'Occupied', value: allUnits.filter(u => u.status === 'occupied').length },
      { name: 'Vacant', value: allUnits.filter(u => u.status === 'vacant').length },
      { name: 'Maintenance', value: allUnits.filter(u => u.status === 'maintenance').length },
    ];
  },
  async getFullResidentHistoryReport() {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(occupancyRecords).orderBy(desc(occupancyRecords.checkInDate));
  },
  async getDetailedUnitReportData() {
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(units).orderBy(asc(units.code));
  }
};

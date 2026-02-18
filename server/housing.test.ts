import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Auth Router", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
  });

  it("clears cookie on logout", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("Dashboard Router", () => {
  it("returns stats with expected shape", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
    expect(stats).toHaveProperty("totalUnits");
    expect(stats).toHaveProperty("occupiedUnits");
    expect(stats).toHaveProperty("vacantUnits");
    expect(stats).toHaveProperty("totalEgyptian");
    expect(stats).toHaveProperty("totalRussian");
    expect(stats).toHaveProperty("totalApartments");
    expect(stats).toHaveProperty("totalChalets");
    expect(stats).toHaveProperty("occupiedApartments");
    expect(stats).toHaveProperty("occupiedChalets");
    expect(typeof stats.totalUnits).toBe("number");
    expect(typeof stats.occupiedUnits).toBe("number");
  });

  it("returns recent activity as array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const activity = await caller.dashboard.recentActivity();
    expect(Array.isArray(activity)).toBe(true);
  });
});

describe("Units Router", () => {
  it("lists units without filters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const units = await caller.units.list({});
    expect(Array.isArray(units)).toBe(true);
  });

  it("lists units with type filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const apartments = await caller.units.list({ type: "apartment" });
    expect(Array.isArray(apartments)).toBe(true);
    for (const unit of apartments) {
      expect(unit.type).toBe("apartment");
    }
  });

  it("lists units with chalet filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const chalets = await caller.units.list({ type: "chalet" });
    expect(Array.isArray(chalets)).toBe(true);
    for (const unit of chalets) {
      expect(unit.type).toBe("chalet");
    }
  });

  it("seeds units when empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.units.seed();
    expect(result).toEqual({ success: true });
  });

  it("gets unit by id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const units = await caller.units.list({});
    if (units.length > 0) {
      const unit = await caller.units.getById({ id: units[0].id });
      expect(unit).toBeDefined();
      expect(unit?.id).toBe(units[0].id);
    }
  });

  it("gets residents for a unit", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const units = await caller.units.list({});
    if (units.length > 0) {
      const residents = await caller.units.getResidents({ unitId: units[0].id });
      expect(residents).toHaveProperty("egyptians");
      expect(residents).toHaveProperty("russians");
      expect(Array.isArray(residents.egyptians)).toBe(true);
      expect(Array.isArray(residents.russians)).toBe(true);
    }
  });
});

describe("Egyptian Residents Router", () => {
  it("lists residents", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const residents = await caller.egyptianResidents.list({});
    expect(Array.isArray(residents)).toBe(true);
  });

  it("checks in a resident to an apartment", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const units = await caller.units.list({ type: "apartment", status: "all" });
    const availableUnit = units.find(u => u.currentOccupants < u.beds);
    if (availableUnit) {
      const result = await caller.egyptianResidents.checkIn({
        name: "أحمد محمد",
        nationalId: "29901011234567",
        phone: "01012345678",
        unitId: availableUnit.id,
      });
      expect(result.success).toBe(true);
      expect(result.residentId).toBeDefined();
    }
  });

  it("rejects check-in to chalet", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const chalets = await caller.units.list({ type: "chalet" });
    const vacantChalet = chalets.find(c => c.currentOccupants < c.beds);
    if (vacantChalet) {
      await expect(
        caller.egyptianResidents.checkIn({
          name: "أحمد محمد",
          nationalId: "29901011234567",
          unitId: vacantChalet.id,
        })
      ).rejects.toThrow("المصريون يسكنون في الشقق فقط");
    }
  });
});

describe("Russian Residents Router", () => {
  it("lists residents", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const residents = await caller.russianResidents.list({});
    expect(Array.isArray(residents)).toBe(true);
  });

  it("checks in a resident to a chalet", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const chalets = await caller.units.list({ type: "chalet", status: "all" });
    const availableChalet = chalets.find(u => u.currentOccupants < u.beds);
    if (availableChalet) {
      const result = await caller.russianResidents.checkIn({
        name: "Ivan Petrov",
        passportNumber: "AB1234567",
        nationality: "Russian",
        gender: "male",
        unitId: availableChalet.id,
      });
      expect(result.success).toBe(true);
      expect(result.residentId).toBeDefined();
    }
  });

  it("rejects check-in to apartment", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const apartments = await caller.units.list({ type: "apartment" });
    const vacantApt = apartments.find(a => a.currentOccupants < a.beds);
    if (vacantApt) {
      await expect(
        caller.russianResidents.checkIn({
          name: "Ivan Petrov",
          passportNumber: "AB1234567",
          nationality: "Russian",
          gender: "male",
          unitId: vacantApt.id,
        })
      ).rejects.toThrow("الروس يسكنون في الشاليهات فقط");
    }
  });
});

describe("Notifications Page Router", () => {
  it("returns all notifications", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const notifications = await caller.notificationsPage.list();
    expect(Array.isArray(notifications)).toBe(true);
  });

  it("returns unread notifications", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const notifications = await caller.notificationsPage.unread();
    expect(Array.isArray(notifications)).toBe(true);
  });

  it("returns notifications filtered by sectorId", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const notifications = await caller.notificationsPage.list({ sectorId: 999 });
    expect(Array.isArray(notifications)).toBe(true);
  });
});

describe("Sectors Router", () => {
  it("lists sectors", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const sectors = await caller.sectors.list();
    expect(Array.isArray(sectors)).toBe(true);
  });

  it("creates a sector", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sectors.create({
      name: "\u0627\u0644\u0636\u0628\u0639\u0629",
      code: "DABAA-TEST-" + Date.now(),
      description: "\u0642\u0637\u0627\u0639 \u0627\u0644\u0636\u0628\u0639\u0629",
      color: "#3b82f6",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("rejects duplicate sector code", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const code = "DUP-TEST-" + Date.now();
    await caller.sectors.create({ name: "Test", code, color: "#ef4444" });
    await expect(
      caller.sectors.create({ name: "Test2", code, color: "#22c55e" })
    ).rejects.toThrow();
  });

  it("lists all users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const users = await caller.sectors.users();
    expect(Array.isArray(users)).toBe(true);
  });
});

describe("Import Units Router", () => {
  it("imports units successfully", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const code = "IMP-TEST-" + Date.now();
    const result = await caller.importUnits.process({
      units: [
        { code, name: "\u0634\u0642\u0629 \u0627\u062e\u062a\u0628\u0627\u0631", type: "apartment", beds: 4 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.created).toBe(1);
  });

  it("skips duplicate unit codes", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const code = "DUP-UNIT-" + Date.now();
    await caller.importUnits.process({
      units: [{ code, name: "Unit1", type: "apartment", beds: 2 }],
    });
    const result = await caller.importUnits.process({
      units: [{ code, name: "Unit1", type: "apartment", beds: 2 }],
    });
    expect(result.skipped).toBe(1);
  });
});

describe("Import Router", () => {
  it("returns import logs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const logs = await caller.import.logs();
    expect(Array.isArray(logs)).toBe(true);
  });
});

describe("Reports Router", () => {
  it("returns occupancy report", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const report = await caller.reports.occupancy();
    expect(report).toHaveProperty("stats");
    expect(report).toHaveProperty("records");
    expect(Array.isArray(report.records)).toBe(true);
  });
});

describe("Eviction Router", () => {
  it("returns error for non-existent resident", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.eviction.process({
      rows: [{ name: "شخص غير موجود", nationalId: "99999999999999", unitCode: "A-1011" }],
      fileName: "test.xlsx",
    });
    expect(result.success).toBe(true);
    expect(result.failedCount).toBe(1);
    expect(result.errors.length).toBe(1);
  });
});

describe("Occupancy Records Router", () => {
  it("returns all records", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const records = await caller.occupancyRecords.list();
    expect(Array.isArray(records)).toBe(true);
  });

  it("returns recent records with limit", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const records = await caller.occupancyRecords.recent({ limit: 5 });
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeLessThanOrEqual(5);
  });
});

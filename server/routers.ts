import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllUnits, getUnitById, getUnitByCode, createUnit, updateUnit, deleteUnit,
  getAllEgyptianResidents, getEgyptianResidentById, createEgyptianResident, updateEgyptianResident, getEgyptianResidentsByUnitId,
  getAllRussianResidents, getRussianResidentById, createRussianResident, updateRussianResident, getRussianResidentsByUnitId,
  createOccupancyRecord, getRecentOccupancyRecords, getAllOccupancyRecords,
  createImportLog, updateImportLog, getAllImportLogs,
  createNotification, getUnreadNotifications, markNotificationRead, getAllNotifications, markAllNotificationsRead,
  getDashboardStats, seedUnits,
  findEgyptianByNationalId, findRussianByPassport,
  findEgyptianByNameAndUnit, findRussianByNameAndUnit,
  getAllSectors, getSectorById, getSectorByCode, createSector, updateSector, deleteSector,
  assignUserToSector, getAllUsers,
  getDetailedUnitReportData, getFullResidentHistoryReport, getOccupancyStatsReport,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { createWorker } from "tesseract.js";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ===== UNITS =====
  units: router({
    list: publicProcedure.input(z.object({
      type: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
      sectorId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return getAllUnits(input ?? undefined);
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getUnitById(input.id);
    }),
    getByCode: publicProcedure.input(z.object({ code: z.string() })).query(async ({ input }) => {
      return getUnitByCode(input.code);
    }),
    create: protectedProcedure.input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(["apartment", "chalet"]),
      sectorId: z.number().optional(),
      floor: z.string().optional(),
      rooms: z.number().min(1).default(1),
      beds: z.number().min(1).default(1),
      ownerName: z.string().optional(),
      buildingName: z.string().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      await createUnit({ ...input, status: "vacant", currentOccupants: 0 });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      code: z.string().optional(),
      name: z.string().optional(),
      type: z.enum(["apartment", "chalet"]).optional(),
      floor: z.string().optional(),
      rooms: z.number().optional(),
      beds: z.number().optional(),
      status: z.enum(["vacant", "occupied", "maintenance"]).optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateUnit(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const unit = await getUnitById(input.id);
      if (!unit) throw new Error("الوحدة غير موجودة");
      if (unit.currentOccupants > 0) throw new Error("لا يمكن حذف وحدة مسكونة حالياً");
      await deleteUnit(input.id);
      return { success: true };
    }),
    detailedReport: publicProcedure.query(async () => {
      return getDetailedUnitReportData();
    }),
    residentHistory: publicProcedure.query(async () => {
      return getFullResidentHistoryReport();
    }),
    occupancyStats: publicProcedure.query(async () => {
      return getOccupancyStatsReport();
    }),
    getResidents: publicProcedure.input(z.object({ unitId: z.number() })).query(async ({ input }) => {
      const egyptians = await getEgyptianResidentsByUnitId(input.unitId);
      const russians = await getRussianResidentsByUnitId(input.unitId);
      return { egyptians, russians };
    }),
    seed: protectedProcedure.mutation(async () => {
      await seedUnits();
      return { success: true };
    }),
  }),

  // UNIFIED REPORTS ROUTER (Compatible with both new and old names)
  allReports: router({
    residentHistory: publicProcedure.query(async () => {
      return getFullResidentHistoryReport();
    }),
    occupancyStats: publicProcedure.query(async () => {
      return getOccupancyStatsReport();
    }),
    detailedUnits: publicProcedure.query(async () => {
      return getDetailedUnitReportData();
    }),
  }),

  // ===== EGYPTIAN RESIDENTS =====
  egyptianResidents: router({
    list: publicProcedure.input(z.object({
      status: z.string().optional(),
      unitId: z.number().optional(),
      search: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return getAllEgyptianResidents(input);
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getEgyptianResidentById(input.id);
    }),
    checkIn: protectedProcedure.input(z.object({
      name: z.string().min(1),
      nationalId: z.string().min(1),
      phone: z.string().optional(),
      shift: z.string().optional(),
      unitId: z.number(),
      checkInDate: z.number().optional(),
      ocrConfidence: z.number().optional(),
      imageUrl: z.string().optional(),
    })).mutation(async ({ input }) => {
      const unit = await getUnitById(input.unitId);
      if (!unit) throw new Error("الوحدة غير موجودة");
      if (unit.currentOccupants >= unit.beds) throw new Error("الوحدة ممتلئة - لا توجد أسرة متاحة");
      if (unit.type !== "apartment") throw new Error("المصريون يسكنون في الشقق فقط");

      const checkInDate = input.checkInDate || Date.now();
      const residentId = await createEgyptianResident({
        ...input,
        checkInDate,
        status: "active",
      });

      await updateUnit(unit.id, {
        currentOccupants: unit.currentOccupants + 1,
        status: "occupied",
      });

      await createOccupancyRecord({
        residentType: "egyptian",
        residentId,
        residentName: input.name,
        unitId: unit.id,
        unitCode: unit.code,
        action: "check_in",
        actionDate: checkInDate,
      });

      await createNotification({
        title: "تسكين جديد",
        message: `تم تسكين ${input.name} في ${unit.code}`,
        type: "success",
      });

      return { success: true, residentId };
    }),
    checkOut: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const resident = await getEgyptianResidentById(input.id);
      if (!resident) throw new Error("الساكن غير موجود");
      if (!resident.unitId) throw new Error("الساكن ليس مسكناً حالياً");

      const unit = await getUnitById(resident.unitId);
      const now = Date.now();

      await updateEgyptianResident(input.id, { status: "checked_out", checkOutDate: now, unitId: null as any });

      if (unit) {
        const newOccupants = Math.max(0, unit.currentOccupants - 1);
        await updateUnit(unit.id, {
          currentOccupants: newOccupants,
          status: newOccupants === 0 ? "vacant" : "occupied",
        });

        await createOccupancyRecord({
          residentType: "egyptian",
          residentId: input.id,
          residentName: resident.name,
          unitId: unit.id,
          unitCode: unit.code,
          action: "check_out",
          actionDate: now,
        });
      }

      return { success: true };
    }),
  }),

  // ===== RUSSIAN RESIDENTS =====
  russianResidents: router({
    list: publicProcedure.input(z.object({
      status: z.string().optional(),
      unitId: z.number().optional(),
      search: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return getAllRussianResidents(input);
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getRussianResidentById(input.id);
    }),
    checkIn: protectedProcedure.input(z.object({
      name: z.string().min(1),
      passportNumber: z.string().min(1),
      nationality: z.string().default("Russian"),
      gender: z.enum(["male", "female"]),
      phone: z.string().optional(),
      shift: z.string().optional(),
      unitId: z.number(),
      checkInDate: z.number().optional(),
      ocrConfidence: z.number().optional(),
      imageUrl: z.string().optional(),
    })).mutation(async ({ input }) => {
      const unit = await getUnitById(input.unitId);
      if (!unit) throw new Error("الوحدة غير موجودة");
      if (unit.currentOccupants >= unit.beds) throw new Error("الوحدة ممتلئة - لا توجد أسرة متاحة");
      if (unit.type !== "chalet") throw new Error("الروس يسكنون في الشاليهات فقط");

      const checkInDate = input.checkInDate || Date.now();
      const residentId = await createRussianResident({
        ...input,
        checkInDate,
        status: "active",
      });

      await updateUnit(unit.id, {
        currentOccupants: unit.currentOccupants + 1,
        status: "occupied",
      });

      await createOccupancyRecord({
        residentType: "russian",
        residentId,
        residentName: input.name,
        unitId: unit.id,
        unitCode: unit.code,
        action: "check_in",
        actionDate: checkInDate,
      });

      await createNotification({
        title: "تسكين جديد",
        message: `تم تسكين ${input.name} في ${unit.code}`,
        type: "success",
      });

      return { success: true, residentId };
    }),
    checkOut: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const resident = await getRussianResidentById(input.id);
      if (!resident) throw new Error("الساكن غير موجود");
      if (!resident.unitId) throw new Error("الساكن ليس مسكناً حالياً");

      const unit = await getUnitById(resident.unitId);
      const now = Date.now();

      await updateRussianResident(input.id, { status: "checked_out", checkOutDate: now, unitId: null as any });

      if (unit) {
        const newOccupants = Math.max(0, unit.currentOccupants - 1);
        await updateUnit(unit.id, {
          currentOccupants: newOccupants,
          status: newOccupants === 0 ? "vacant" : "occupied",
        });

        await createOccupancyRecord({
          residentType: "russian",
          residentId: input.id,
          residentName: resident.name,
          unitId: unit.id,
          unitCode: unit.code,
          action: "check_out",
          actionDate: now,
        });
      }

      return { success: true };
    }),
  }),

  // ===== SECTORS =====
  sectors: router({
    list: publicProcedure.query(async () => {
      return getAllSectors();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getSectorById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      description: z.string().optional(),
      color: z.string().optional(),
    })).mutation(async ({ input }) => {
      await createSector(input);
      return { success: true };
    }),
  }),

  // ===== OCR =====
  ocr: router({
    extract: protectedProcedure.input(z.object({
      imageUrl: z.string(),
      type: z.enum(["egyptian_id", "russian_passport"]),
    })).mutation(async ({ input }) => {
      try {
        const worker = await createWorker(input.type === "egyptian_id" ? "ara+eng" : "rus+eng");
        const { data: { text } } = await worker.recognize(input.imageUrl);
        await worker.terminate();

        // Basic Regex Extraction
        let name = "";
        let idNumber = "";

        if (input.type === "egyptian_id") {
          const idMatch = text.match(/\d{14}/);
          if (idMatch) idNumber = idMatch[0];
          // Simple name extraction (first line or similar)
          const lines = text.split('\n').filter(l => l.trim().length > 5);
          if (lines.length > 0) name = lines[0].trim();
        } else {
          const passMatch = text.match(/[A-Z0-9]{9,12}/);
          if (passMatch) idNumber = passMatch[0];
          const lines = text.split('\n').filter(l => l.trim().length > 5);
          if (lines.length > 0) name = lines[0].trim();
        }

        return {
          success: true,
          data: { name, idNumber, confidence: 0.8 }
        };
      } catch (error: any) {
        throw new Error("فشل استخراج البيانات: " + error.message);
      }
    }),
  }),

  // ===== STATS =====
  stats: router({
    dashboard: publicProcedure.input(z.object({ sectorId: z.number().optional() })).query(async ({ input }) => {
      return getDashboardStats(input?.sectorId);
    }),
  }),
});

export type AppRouter = typeof appRouter;

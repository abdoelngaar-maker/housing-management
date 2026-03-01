import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
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
      return db.getAllUnits(input?.sectorId);
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getUnitById(input.id);
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
      await db.createUnit({ ...input, status: "vacant", currentOccupants: 0 });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteUnit(input.id);
      return { success: true };
    }),
  }),

  // ===== RESIDENTS =====
  residents: router({
    checkInEgyptian: protectedProcedure.input(z.object({
      name: z.string().min(1),
      nationalId: z.string().min(1),
      phone: z.string().optional(),
      unitId: z.number(),
      checkInDate: z.number().optional(),
    })).mutation(async ({ input }) => {
      const checkInDate = input.checkInDate ? new Date(input.checkInDate) : new Date();
      await db.createEgyptianResident({
        ...input,
        checkInDate,
        status: "active",
      });
      return { success: true };
    }),
    checkInRussian: protectedProcedure.input(z.object({
      name: z.string().min(1),
      passportNumber: z.string().min(1),
      gender: z.enum(["male", "female"]),
      unitId: z.number(),
      checkInDate: z.number().optional(),
    })).mutation(async ({ input }) => {
      const checkInDate = input.checkInDate ? new Date(input.checkInDate) : new Date();
      await db.createRussianResident({
        ...input,
        checkInDate,
        status: "active",
      });
      return { success: true };
    }),
    checkOut: protectedProcedure.input(z.object({
      type: z.enum(["egyptian", "russian"]),
      id: z.number()
    })).mutation(async ({ input }) => {
      await db.checkoutResident(input.type, input.id);
      return { success: true };
    }),
  }),

  // ===== REPORTS (UNIFIED) =====
  allReports: router({
    residentHistory: publicProcedure.query(async () => {
      return db.getFullResidentHistoryReport();
    }),
    occupancyStats: publicProcedure.query(async () => {
      return db.getOccupancyStatsReport();
    }),
    detailedUnits: publicProcedure.query(async () => {
      return db.getDetailedUnitReportData();
    }),
  }),

  // ===== SECTORS =====
  sectors: router({
    list: publicProcedure.query(async () => {
      return db.getAllSectors();
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      code: z.string().min(1),
    })).mutation(async ({ input }) => {
      await db.createSector(input);
      return { success: true };
    }),
  }),

  // ===== OCR (TESSERACT) =====
  ocr: router({
    extract: protectedProcedure.input(z.object({
      imageUrl: z.string(),
      type: z.enum(["egyptian_id", "russian_passport"]),
    })).mutation(async ({ input }) => {
      try {
        const worker = await createWorker(input.type === "egyptian_id" ? "ara+eng" : "rus+eng");
        const { data: { text } } = await worker.recognize(input.imageUrl);
        await worker.terminate();

        let idNumber = "";
        if (input.type === "egyptian_id") {
          const match = text.match(/\d{14}/);
          if (match) idNumber = match[0];
        } else {
          const match = text.match(/[A-Z0-9]{9,12}/);
          if (match) idNumber = match[0];
        }

        const lines = text.split('\n').filter(l => l.trim().length > 5);
        const name = lines.length > 0 ? lines[0].trim() : "";

        return { success: true, data: { name, idNumber, confidence: 0.8 } };
      } catch (error: any) {
        throw new Error("فشل استخراج البيانات: " + error.message);
      }
    }),
  }),

  // ===== STATS =====
  stats: router({
    dashboard: publicProcedure.input(z.object({ sectorId: z.number().optional() })).query(async ({ input }) => {
      return db.getDashboardStats(input?.sectorId);
    }),
  }),
});

export type AppRouter = typeof appRouter;

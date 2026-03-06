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

  // ===== RESIDENTS (original paths) =====
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

  // ===== EGYPTIAN RESIDENTS (Frontend expects this path) =====
  egyptianResidents: router({
    checkIn: protectedProcedure.input(z.object({
      name: z.string().min(1),
      nationalId: z.string().min(1),
      phone: z.string().optional(),
      shift: z.string().optional(),
      unitId: z.number(),
      checkInDate: z.number().optional(),
      ocrConfidence: z.number().optional(),
    })).mutation(async ({ input }) => {
      const checkInDate = input.checkInDate ? new Date(input.checkInDate) : new Date();
      await db.createEgyptianResident({
        name: input.name,
        nationalId: input.nationalId,
        phone: input.phone,
        unitId: input.unitId,
        checkInDate,
        status: "active",
      });
      return { success: true };
    }),
  }),

  // ===== RUSSIAN RESIDENTS (Frontend expects this path) =====
  russianResidents: router({
    checkIn: protectedProcedure.input(z.object({
      name: z.string().min(1),
      passportNumber: z.string().min(1),
      nationality: z.string().optional(),
      gender: z.enum(["male", "female"]),
      phone: z.string().optional(),
      shift: z.string().optional(),
      unitId: z.number(),
      checkInDate: z.number().optional(),
      ocrConfidence: z.number().optional(),
    })).mutation(async ({ input }) => {
      const checkInDate = input.checkInDate ? new Date(input.checkInDate) : new Date();
      await db.createRussianResident({
        name: input.name,
        passportNumber: input.passportNumber,
        gender: input.gender,
        unitId: input.unitId,
        checkInDate,
        status: "active",
      });
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

  // ===== OCR (TESSERACT - FREE) =====
  ocr: router({
    // Original extract endpoint
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

    // Frontend expects scanEgyptianId (accepts imageBase64)
    scanEgyptianId: protectedProcedure.input(z.object({
      imageBase64: z.string(),
    })).mutation(async ({ input }) => {
      try {
        const worker = await createWorker("ara+eng");
        const { data: { text, confidence } } = await worker.recognize(input.imageBase64);
        await worker.terminate();

        // Extract 14-digit Egyptian national ID
        let nationalId = "";
        const idMatch = text.match(/\d{14}/);
        if (idMatch) nationalId = idMatch[0];

        // Try to extract name from Arabic text lines
        const lines = text.split('\n').filter(l => l.trim().length > 3);
        let name = "";
        for (const line of lines) {
          const arabicLine = line.trim();
          if (/[\u0600-\u06FF]/.test(arabicLine) && arabicLine.length > 5) {
            if (!arabicLine.includes("بطاقة") && !arabicLine.includes("رقم") && !arabicLine.includes("جمهورية")) {
              name = arabicLine;
              break;
            }
          }
        }

        const results = [{
          name,
          nationalId,
          confidence: confidence / 100,
        }];

        return { results };
      } catch (error: any) {
        throw new Error("فشل استخراج بيانات البطاقة المصرية: " + error.message);
      }
    }),

    // Frontend expects scanRussianPassport (accepts imageBase64)
    scanRussianPassport: protectedProcedure.input(z.object({
      imageBase64: z.string(),
    })).mutation(async ({ input }) => {
      try {
        const worker = await createWorker("rus+eng");
        const { data: { text, confidence } } = await worker.recognize(input.imageBase64);
        await worker.terminate();

        // Extract passport number
        let passportNumber = "";
        const passportMatch = text.match(/[A-Z0-9]{9,12}/);
        if (passportMatch) passportNumber = passportMatch[0];

        // Try to extract name
        const lines = text.split('\n').filter(l => l.trim().length > 3);
        let name = "";
        let nationality = "Russian";
        let gender = "male";

        for (const line of lines) {
          const trimmed = line.trim();
          if (/^[A-Z][a-zA-Z\s]+$/.test(trimmed) && trimmed.length > 5) {
            name = trimmed;
            break;
          }
        }

        if (text.toLowerCase().includes("female") || text.includes("Ж") || text.includes("жен")) {
          gender = "female";
        }

        const results = [{
          name,
          passportNumber,
          nationality,
          gender,
          confidence: confidence / 100,
        }];

        return { results };
      } catch (error: any) {
        throw new Error("فشل استخراج بيانات جواز السفر: " + error.message);
      }
    }),
  }),

  // ===== DASHBOARD STATS (Frontend expects this path) =====
  dashboard: router({
    stats: publicProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).query(async ({ input }) => {
      return db.getDashboardStats(input?.sectorId);
    }),
  }),

  // ===== STATS (original path) =====
  stats: router({
    dashboard: publicProcedure.input(z.object({ sectorId: z.number().optional() })).query(async ({ input }) => {
      return db.getDashboardStats(input?.sectorId);
    }),
  }),
});

export type AppRouter = typeof appRouter;


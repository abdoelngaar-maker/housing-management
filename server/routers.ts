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
    getResidents: publicProcedure.input(z.object({ unitId: z.number() })).query(async ({ input }) => {
      return db.getUnitResidents(input.unitId);
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
    if (unit.currentOccupants > 0) {
  toast.error("لا يمكن حذف وحدة بها سكان");
  return;
}
delete: protectedProcedure
  .input(z.object({
    id: z.number()
  }))
  .mutation(async ({ input, ctx }) => {

    await ctx.db.unit.delete({
      where: { id: input.id }
    });

    return { success: true };
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
      const checkInDate = input.checkInDate || Date.now();
      await db.createEgyptianResident({ ...input, checkInDate, status: "active" });
      return { success: true };
    }),
    checkInRussian: protectedProcedure.input(z.object({
      name: z.string().min(1),
      passportNumber: z.string().min(1),
      gender: z.enum(["male", "female"]),
      unitId: z.number(),
      checkInDate: z.number().optional(),
    })).mutation(async ({ input }) => {
      const checkInDate = input.checkInDate || Date.now();
      await db.createRussianResident({ ...input, checkInDate, status: "active" });
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

  // ===== EGYPTIAN RESIDENTS =====
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
      const checkInDate = input.checkInDate || Date.now();
      await db.createEgyptianResident({
        name: input.name, nationalId: input.nationalId, phone: input.phone,
        shift: input.shift, unitId: input.unitId, checkInDate, status: "active",
        ocrConfidence: input.ocrConfidence,
      });
      return { success: true };
    }),
    checkOut: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.checkoutResident("egyptian", input.id);
      return { success: true };
    }),
  }),

  // ===== RUSSIAN RESIDENTS =====
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
      const checkInDate = input.checkInDate || Date.now();
      await db.createRussianResident({
        name: input.name, passportNumber: input.passportNumber, nationality: input.nationality,
        gender: input.gender, phone: input.phone, shift: input.shift,
        unitId: input.unitId, checkInDate, status: "active",
        ocrConfidence: input.ocrConfidence,
      });
      return { success: true };
    }),
    checkOut: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.checkoutResident("russian", input.id);
      return { success: true };
    }),
  }),

  // ===== BULK CHECK-IN =====
  bulkCheckIn: router({
    egyptian: protectedProcedure.input(z.object({
      residents: z.array(z.object({
        name: z.string(), nationalId: z.string(), phone: z.string().optional(),
        shift: z.string().optional(), ocrConfidence: z.number().optional(),
      })),
      unitId: z.number(),
      checkInDate: z.number(),
    })).mutation(async ({ input }) => {
      return db.bulkCheckInEgyptians(input.residents, input.unitId, input.checkInDate);
    }),
    russian: protectedProcedure.input(z.object({
      residents: z.array(z.object({
        name: z.string(), passportNumber: z.string(), nationality: z.string().optional(),
        gender: z.enum(["male", "female"]), phone: z.string().optional(),
        shift: z.string().optional(), ocrConfidence: z.number().optional(),
      })),
      unitId: z.number(),
      checkInDate: z.number(),
    })).mutation(async ({ input }) => {
      return db.bulkCheckInRussians(input.residents, input.unitId, input.checkInDate);
    }),
  }),

  // ===== TRANSFER =====
  transfer: router({
    execute: protectedProcedure.input(z.object({
      residents: z.array(z.object({
        id: z.number(),
        type: z.enum(["egyptian", "russian"]),
        name: z.string(),
      })),
      fromUnitId: z.number(),
      toUnitId: z.number(),
    })).mutation(async ({ input }) => {
      return db.transferResidents(input.residents, input.fromUnitId, input.toUnitId);
    }),
  }),

  // ===== EVICTION =====
  eviction: router({
    process: protectedProcedure.input(z.object({
      rows: z.array(z.object({
        name: z.string(),
        nationalId: z.string().optional(),
        unitCode: z.string().optional(),
        checkOutDate: z.string().optional(),
        reason: z.string().optional(),
      })),
      fileName: z.string().optional(),
    })).mutation(async ({ input }) => {
      return db.processEviction(input.rows, input.fileName || "eviction");
    }),
  }),

  // ===== IMPORT =====
  import: router({
    logs: publicProcedure.query(async () => {
      return db.getImportLogs();
    }),
    process: protectedProcedure.input(z.object({
      rows: z.array(z.object({
        name: z.string(),
        nationalId: z.string(),
        phone: z.string().optional(),
        checkInDate: z.string().optional(),
        unitCode: z.string().optional(),
        shift: z.string().optional(),
        checkOutDate: z.string().optional(),
      })),
      fileName: z.string().optional(),
    })).mutation(async ({ input }) => {
      return db.processImport(input.rows, input.fileName || "import");
    }),
  }),

  // ===== IMPORT UNITS =====
  importUnits: router({
    process: protectedProcedure.input(z.object({
      sectorId: z.number().optional(),
      units: z.array(z.object({
        code: z.string(),
        name: z.string(),
        type: z.enum(["apartment", "chalet"]),
        floor: z.string().optional(),
        rooms: z.number().optional(),
        beds: z.number(),
        notes: z.string().optional(),
      })),
    })).mutation(async ({ input }) => {
      return db.processUnitImport(input.sectorId, input.units);
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

  // ===== REPORTS (Reports.tsx page) =====
  reports: router({
    occupancy: publicProcedure.query(async () => {
      return db.getOccupancyReportData();
    }),
    aiInsights: protectedProcedure.input(z.object({
      stats: z.any(),
    })).mutation(async ({ input }) => {
      try {
        const statsStr = JSON.stringify(input.stats, null, 2);
        const prompt = `Ø£ÙØª ÙØ­ÙÙ Ø¨ÙØ§ÙØ§Øª Ø¥Ø³ÙØ§Ù. Ø­ÙÙ Ø§ÙØ¥Ø­ØµØ§Ø¦ÙØ§Øª Ø§ÙØªØ§ÙÙØ© ÙÙØ¯Ù Ø±Ø¤Ù ÙØªÙØµÙØ§Øª Ø¨Ø§ÙÙØºØ© Ø§ÙØ¹Ø±Ø¨ÙØ©:\n\n${statsStr}\n\nÙØ¯Ù:\n1. ÙÙØ®Øµ Ø§ÙÙØ¶Ø¹ Ø§ÙØ­Ø§ÙÙ\n2. ÙÙØ§Ø· Ø§ÙÙÙØ©\n3. ÙÙØ§Ø· Ø§ÙØ¶Ø¹Ù\n4. ØªÙØµÙØ§Øª ÙÙØªØ­Ø³ÙÙ`;
        const result = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
        const insights = result?.choices?.[0]?.message?.content || "ÙØ§ ØªØªÙÙØ± Ø±Ø¤Ù Ø­Ø§ÙÙØ§Ù. ÙØ±Ø¬Ù Ø§ÙÙØ­Ø§ÙÙØ© ÙØ§Ø­ÙØ§Ù.";
        return { insights };
      } catch (error: any) {
        return { insights: `ØªØ­ÙÙÙ ØªÙÙØ§Ø¦Ù:\n\n- Ø¥Ø¬ÙØ§ÙÙ Ø§ÙÙØ­Ø¯Ø§Øª: ${input.stats?.totalUnits || 0}\n- Ø§ÙÙØ­Ø¯Ø§Øª Ø§ÙÙØ´ØºÙÙØ©: ${input.stats?.occupiedUnits || 0}\n- Ø§ÙÙØ­Ø¯Ø§Øª Ø§ÙØ´Ø§ØºØ±Ø©: ${input.stats?.vacantUnits || 0}\n- ÙØ¹Ø¯Ù Ø§ÙØ¥Ø´ØºØ§Ù: ${input.stats?.occupancyRate || 0}%\n\nÙÙØ§Ø­Ø¸Ø©: Ø§ÙØªØ­ÙÙÙ Ø§ÙØ°ÙÙ ØºÙØ± ÙØªØ§Ø­ Ø­Ø§ÙÙØ§Ù.` };
      }
    }),
  }),

  // ===== SECTORS =====
  sectors: router({
    list: publicProcedure.query(async () => {
      return db.getAllSectors();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getSectorById(input.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      description: z.string().optional(),
      color: z.string().optional(),
    })).mutation(async ({ input }) => {
      await db.createSector(input);
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      code: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateSector(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteSector(input.id);
      return { success: true };
    }),
    users: publicProcedure.query(async () => {
      return db.getAllUsers();
    }),
    assignUser: protectedProcedure.input(z.object({
      userId: z.number(),
      sectorId: z.number().nullable(),
    })).mutation(async ({ input }) => {
      await db.assignUserToSector(input.userId, input.sectorId);
      return { success: true };
    }),
  }),

  // ===== NOTIFICATIONS =====
  notificationsPage: router({
    list: publicProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).query(async ({ input }) => {
      return db.getNotifications(input?.sectorId);
    }),
    unread: publicProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).query(async ({ input }) => {
      return db.getUnreadNotificationCount(input?.sectorId);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.markNotificationAsRead(input.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).mutation(async ({ input }) => {
      await db.markAllNotificationsAsRead(input?.sectorId);
      return { success: true };
    }),
  }),

  // ===== OCR (TESSERACT - FREE) =====
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
        const lines = text.split('\n').filter((l: string) => l.trim().length > 5);
        const name = lines.length > 0 ? lines[0].trim() : "";
        return { success: true, data: { name, idNumber, confidence: 0.8 } };
      } catch (error: any) {
        throw new Error("ÙØ´Ù Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§ÙØ¨ÙØ§ÙØ§Øª: " + error.message);
      }
    }),

    scanEgyptianId: protectedProcedure.input(z.object({
      imageBase64: z.string(),
    })).mutation(async ({ input }) => {
      try {
        const worker = await createWorker("ara+eng");
        const { data: { text, confidence } } = await worker.recognize(input.imageBase64);
        await worker.terminate();
        let nationalId = "";
        const idMatch = text.match(/\d{14}/);
        if (idMatch) nationalId = idMatch[0];
        const lines = text.split('\n').filter((l: string) => l.trim().length > 3);
        let name = "";
        for (const line of lines) {
          const arabicLine = line.trim();
          if (/[\u0600-\u06FF]/.test(arabicLine) && arabicLine.length > 5) {
            if (!arabicLine.includes("\u0628\u0637\u0627\u0642\u0629") && !arabicLine.includes("\u0631\u0642\u0645") && !arabicLine.includes("\u062c\u0645\u0647\u0648\u0631\u064a\u0629")) {
              name = arabicLine;
              break;
            }
          }
        }
        const results = [{ name, nationalId, confidence: confidence / 100 }];
        return { results };
      } catch (error: any) {
        throw new Error("\u0641\u0634\u0644 \u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0645\u0635\u0631\u064a\u0629: " + error.message);
      }
    }),

    scanRussianPassport: protectedProcedure.input(z.object({
      imageBase64: z.string(),
    })).mutation(async ({ input }) => {
      try {
        const worker = await createWorker("rus+eng");
        const { data: { text, confidence } } = await worker.recognize(input.imageBase64);
        await worker.terminate();
        let passportNumber = "";
        const passportMatch = text.match(/[A-Z0-9]{9,12}/);
        if (passportMatch) passportNumber = passportMatch[0];
        const lines = text.split('\n').filter((l: string) => l.trim().length > 3);
        let name = "";
        let nationality = "Russian";
        let gender: "male" | "female" = "male";
        for (const line of lines) {
          const trimmed = line.trim();
          if (/^[A-Z][a-zA-Z\s]+$/.test(trimmed) && trimmed.length > 5) {
            name = trimmed;
            break;
          }
        }
        if (text.toLowerCase().includes("female") || text.includes("\u0416") || text.includes("\u0436\u0435\u043d")) {
          gender = "female";
        }
        const results = [{ name, passportNumber, nationality, gender, confidence: confidence / 100 }];
        return { results };
      } catch (error: any) {
        throw new Error("\u0641\u0634\u0644 \u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0628\u064a\u0627\u0646\u0627\u062a \u062c\u0648\u0627\u0632 \u0627\u0644\u0633\u0641\u0631: " + error.message);
      }
    }),
  }),

  // ===== DASHBOARD =====
  dashboard: router({
    stats: publicProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).query(async ({ input }) => {
      return db.getDashboardStats(input?.sectorId);
    }),
    recentActivity: publicProcedure.query(async () => {
      return db.getRecentActivity(20);
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

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

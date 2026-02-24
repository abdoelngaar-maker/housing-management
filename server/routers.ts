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
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

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
      await deleteUnit(input.id);
      return { success: true };
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
      const fromUnit = await getUnitById(input.fromUnitId);
      const toUnit = await getUnitById(input.toUnitId);
      if (!fromUnit || !toUnit) throw new Error("الوحدة غير موجودة");

      const availableBeds = toUnit.beds - toUnit.currentOccupants;
      if (input.residents.length > availableBeds) throw new Error(`لا توجد أسرة كافية في الوحدة الهدف. المتاح: ${availableBeds}`);

      const now = Date.now();

      for (const resident of input.residents) {
        if (resident.type === "egyptian") {
          await updateEgyptianResident(resident.id, { unitId: toUnit.id, status: "active" });
        } else {
          await updateRussianResident(resident.id, { unitId: toUnit.id, status: "active" });
        }

        await createOccupancyRecord({
          residentType: resident.type,
          residentId: resident.id,
          residentName: resident.name,
          unitId: toUnit.id,
          unitCode: toUnit.code,
          action: "transfer_in",
          fromUnitId: fromUnit.id,
          fromUnitCode: fromUnit.code,
          actionDate: now,
        });

        await createOccupancyRecord({
          residentType: resident.type,
          residentId: resident.id,
          residentName: resident.name,
          unitId: fromUnit.id,
          unitCode: fromUnit.code,
          action: "transfer_out",
          fromUnitId: toUnit.id,
          fromUnitCode: toUnit.code,
          actionDate: now,
        });
      }

      const transferCount = input.residents.length;
      const newFromOccupants = Math.max(0, fromUnit.currentOccupants - transferCount);
      const newToOccupants = toUnit.currentOccupants + transferCount;

      await updateUnit(fromUnit.id, {
        currentOccupants: newFromOccupants,
        status: newFromOccupants === 0 ? "vacant" : "occupied",
      });

      await updateUnit(toUnit.id, {
        currentOccupants: newToOccupants,
        status: "occupied",
      });

      await createNotification({
        title: "نقل ساكنين",
        message: `تم نقل ${transferCount} ساكن من ${fromUnit.code} إلى ${toUnit.code}`,
        type: "info",
      });

      return { success: true, transferred: transferCount };
    }),
  }),

  // ===== OCR =====
  ocr: router({
    scanEgyptianId: protectedProcedure.input(z.object({
      imageBase64: z.string(),
    })).mutation(async ({ input }) => {
      // Stage 1: Initial extraction with very detailed prompt
      const stage1 = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `أنت نظام OCR متطور جداً متخصص في استخراج البيانات من بطاقات الرقم القومي المصرية بدقة 100%.
            
            قواعد الاستخراج الصارمة:
            1. الاسم: استخرج الاسم الكامل كما هو مكتوب (ثلاثي أو رباعي أو خماسي). الاسم يقع دائماً في السطر الأول بجوار كلمة "الاسم". لا تختصر أي جزء.
            2. الرقم القومي: يجب أن يكون 14 رقماً بالضبط. تأكد من قراءة كل رقم بدقة متناهية. الرقم الأول من اليسار يمثل القرن (2 للمواليد من 1900-1999، و3 للمواليد من 2000-2099).
            3. العنوان: إذا طلبت، استخرج العنوان كاملاً من السطر الثاني والثالث.
            4. درجة الثقة: حدد درجة الثقة (0-100) لكل حقل.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "قم بتحليل هذه البطاقة المصرية واستخراج الاسم الكامل (ثلاثي/رباعي/خماسي) والرقم القومي (14 رقم) بدقة متناهية:" },
              { type: "image_url", image_url: { url: input.imageBase64, detail: "high" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "egyptian_id_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "الاسم الكامل بالعربية كما هو مكتوب على البطاقة (ثلاثي أو رباعي)" },
                      nationalId: { type: "string", description: "الرقم القومي 14 رقم بالضبط" },
                      confidence: { type: "number", description: "درجة الثقة من 0 إلى 100" }
                    },
                    required: ["name", "nationalId", "confidence"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["results"],
              additionalProperties: false,
            }
          }
        }
      });

      const stage1Data = JSON.parse(stage1.choices[0].message.content as string);

      // Stage 2: Strict verification - re-read the image independently
      const stage2 = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `أنت خبير تدقيق بيانات الهوية المصرية. مهمتك مراجعة البيانات المستخرجة وتصحيحها من الصورة مباشرة لضمان دقة 100%.
            
            قواعد التدقيق:
            1. قارن الاسم المستخرج بالصورة حرفاً بحرف. تأكد أنه الاسم الكامل كما هو مطبوع.
            2. دقق في الرقم القومي (14 رقم). الرقم الأول يجب أن يطابق سنة الميلاد (مثلاً 2 لمواليد القرن العشرين).
            3. إذا كان هناك أي شك، أعد قراءة الحقل من الصورة مرة أخرى بتركيز عالي.
            4. الرقم القومي المصري لا يحتوي على حروف، فقط أرقام.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `البيانات المستخرجة في المرحلة الأولى: ${JSON.stringify(stage1Data.results)}\n\nبرجاء إعادة فحص الصورة وتصحيح أي أخطاء في الاسم أو الرقم القومي لضمان دقة 100%:` },
              { type: "image_url", image_url: { url: input.imageBase64, detail: "high" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "egyptian_id_verification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      nationalId: { type: "string" },
                      confidence: { type: "number" }
                    },
                    required: ["name", "nationalId", "confidence"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["results"],
              additionalProperties: false,
            }
          }
        }
      });

      const verifiedData = JSON.parse(stage2.choices[0].message.content as string);
      return verifiedData;
    }),

    scanRussianPassport: protectedProcedure.input(z.object({
      imageBase64: z.string(),
    })).mutation(async ({ input }) => {
      // Stage 1: Detailed extraction
      const stage1 = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a high-precision OCR engine for Russian passports. 100% accuracy is mandatory.
            
            Strict Extraction Protocol:
            1. Full Name: Extract the COMPLETE name (Surname, Given Names, Patronymic). Cross-reference the visual zone (Cyrillic and Latin) with the MRZ zone (bottom of page). Use the Latin version.
            2. Passport Number: Extract all digits/letters carefully. Check both the top right corner and the MRZ zone.
            3. Nationality & Gender: Extract precisely.
            4. MRZ Zone: Pay special attention to the machine-readable zone at the bottom to verify the passport number and name.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this Russian passport and extract the COMPLETE Latin name and passport number with 100% accuracy:" },
              { type: "image_url", image_url: { url: input.imageBase64, detail: "high" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "russian_passport_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      passportNumber: { type: "string" },
                      nationality: { type: "string" },
                      gender: { type: "string", enum: ["male", "female"] },
                      confidence: { type: "number" }
                    },
                    required: ["name", "passportNumber", "nationality", "gender", "confidence"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["results"],
              additionalProperties: false,
            }
          }
        }
      });

      const stage1Data = JSON.parse(stage1.choices[0].message.content as string);

      // Stage 2: Strict verification
      const stage2 = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a professional passport data auditor. Your goal is to eliminate any errors from the initial OCR pass.
            
            Auditing Protocol:
            1. Re-examine the image specifically focusing on the Passport Number and the Full Latin Name.
            2. Compare with the initial data provided. If there's any discrepancy, the image is the source of truth.
            3. Ensure the name includes all parts (Surname and all Given Names).
            4. Verify the Passport Number against the MRZ zone at the bottom.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Initial data: ${JSON.stringify(stage1Data.results)}\n\nPlease perform a final audit of the passport image and provide the corrected, 100% accurate data:` },
              { type: "image_url", image_url: { url: input.imageBase64, detail: "high" } }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "russian_passport_verification",
            strict: true,
            schema: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      passportNumber: { type: "string" },
                      nationality: { type: "string" },
                      gender: { type: "string", enum: ["male", "female"] },
                      confidence: { type: "number" }
                    },
                    required: ["name", "passportNumber", "nationality", "gender", "confidence"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["results"],
              additionalProperties: false,
            }
          }
        }
      });

      const verifiedData = JSON.parse(stage2.choices[0].message.content as string);
      return verifiedData;
    }),

    uploadImage: protectedProcedure.input(z.object({
      imageBase64: z.string(),
      fileName: z.string(),
    })).mutation(async ({ input }) => {
      const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const ext = input.fileName.split('.').pop() || 'jpg';
      const key = `ocr-images/${nanoid()}.${ext}`;
      const { url } = await storagePut(key, buffer, `image/${ext}`);
      return { url };
    }),
  }),

  // ===== BULK IMPORT =====
  import: router({
    process: protectedProcedure.input(z.object({
      rows: z.array(z.object({
        name: z.string(),
        nationalId: z.string().optional(),
        phone: z.string().optional(),
        checkInDate: z.string().optional(),
        unitCode: z.string().optional(),
        shift: z.string().optional(),
        checkOutDate: z.string().optional(),
      })),
      fileName: z.string(),
    })).mutation(async ({ input }) => {
      const logId = await createImportLog({
        fileName: input.fileName,
        totalRows: input.rows.length,
        status: "processing",
      });

      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i];
        try {
          if (!row.name || !row.unitCode) {
            throw new Error("الاسم وكود الوحدة مطلوبان");
          }

          const unit = await getUnitByCode(row.unitCode);
          if (!unit) throw new Error(`الوحدة ${row.unitCode} غير موجودة`);
          if (unit.currentOccupants >= unit.beds) throw new Error(`الوحدة ${row.unitCode} ممتلئة`);

          const now = Date.now();
          const checkInDate = row.checkInDate ? new Date(row.checkInDate).getTime() : now;
          const checkOutDate = row.checkOutDate ? new Date(row.checkOutDate).getTime() : undefined;

          if (unit.type === "apartment") {
            const residentId = await createEgyptianResident({
              name: row.name,
              nationalId: row.nationalId || "",
              phone: row.phone,
              shift: row.shift,
              unitId: unit.id,
              checkInDate,
              checkOutDate: checkOutDate as any,
              status: checkOutDate ? "checked_out" : "active",
            });

            if (!checkOutDate) {
              await updateUnit(unit.id, {
                currentOccupants: unit.currentOccupants + 1,
                status: "occupied",
              });
            }

            await createOccupancyRecord({
              residentType: "egyptian",
              residentId,
              residentName: row.name,
              unitId: unit.id,
              unitCode: unit.code,
              action: "check_in",
              actionDate: checkInDate,
            });
          } else {
            const residentId = await createRussianResident({
              name: row.name,
              passportNumber: row.nationalId || "",
              nationality: "Russian",
              gender: "male",
              phone: row.phone,
              shift: row.shift,
              unitId: unit.id,
              checkInDate,
              checkOutDate: checkOutDate as any,
              status: checkOutDate ? "checked_out" : "active",
            });

            if (!checkOutDate) {
              await updateUnit(unit.id, {
                currentOccupants: unit.currentOccupants + 1,
                status: "occupied",
              });
            }

            await createOccupancyRecord({
              residentType: "russian",
              residentId,
              residentName: row.name,
              unitId: unit.id,
              unitCode: unit.code,
              action: "check_in",
              actionDate: checkInDate,
            });
          }

          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push({ row: i + 1, error: err.message || "خطأ غير معروف" });
        }
      }

      await updateImportLog(logId, {
        successRows: successCount,
        failedRows: failedCount,
        errors: errors as any,
        status: failedCount === input.rows.length ? "failed" : "completed",
      });

      return { success: true, logId, successCount, failedCount, errors };
    }),
    logs: publicProcedure.query(async () => {
      return getAllImportLogs();
    }),
  }),

  // ===== BULK EVICTION (CHECK-OUT) =====
  eviction: router({
    process: protectedProcedure.input(z.object({
      rows: z.array(z.object({
        name: z.string(),
        nationalId: z.string().optional(),
        unitCode: z.string().optional(),
        checkOutDate: z.string().optional(),
        reason: z.string().optional(),
      })),
      fileName: z.string(),
    })).mutation(async ({ input }) => {
      const logId = await createImportLog({
        fileName: `[إخلاء] ${input.fileName}`,
        totalRows: input.rows.length,
        status: "processing",
      });

      let successCount = 0;
      let failedCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < input.rows.length; i++) {
        const row = input.rows[i];
        try {
          if (!row.name) throw new Error("الاسم مطلوب");

          const checkOutDate = row.checkOutDate ? new Date(row.checkOutDate).getTime() : Date.now();
          let found = false;

          // Try to find by nationalId/passport first
          if (row.nationalId) {
            const egyptian = await findEgyptianByNationalId(row.nationalId);
            if (egyptian && egyptian.unitId) {
              const unit = await getUnitById(egyptian.unitId);
              await updateEgyptianResident(egyptian.id, { status: "checked_out", checkOutDate, unitId: null as any });
              if (unit) {
                const newOcc = Math.max(0, unit.currentOccupants - 1);
                await updateUnit(unit.id, { currentOccupants: newOcc, status: newOcc === 0 ? "vacant" : "occupied" });
                await createOccupancyRecord({ residentType: "egyptian", residentId: egyptian.id, residentName: egyptian.name, unitId: unit.id, unitCode: unit.code, action: "check_out", actionDate: checkOutDate, notes: row.reason });
              }
              found = true;
            }
            if (!found) {
              const russian = await findRussianByPassport(row.nationalId);
              if (russian && russian.unitId) {
                const unit = await getUnitById(russian.unitId);
                await updateRussianResident(russian.id, { status: "checked_out", checkOutDate, unitId: null as any });
                if (unit) {
                  const newOcc = Math.max(0, unit.currentOccupants - 1);
                  await updateUnit(unit.id, { currentOccupants: newOcc, status: newOcc === 0 ? "vacant" : "occupied" });
                  await createOccupancyRecord({ residentType: "russian", residentId: russian.id, residentName: russian.name, unitId: unit.id, unitCode: unit.code, action: "check_out", actionDate: checkOutDate, notes: row.reason });
                }
                found = true;
              }
            }
          }

          // Fallback: find by name + unit code
          if (!found && row.unitCode) {
            const unit = await getUnitByCode(row.unitCode);
            if (!unit) throw new Error(`الوحدة ${row.unitCode} غير موجودة`);

            if (unit.type === "apartment") {
              const egyptian = await findEgyptianByNameAndUnit(row.name, unit.id);
              if (egyptian) {
                await updateEgyptianResident(egyptian.id, { status: "checked_out", checkOutDate, unitId: null as any });
                const newOcc = Math.max(0, unit.currentOccupants - 1);
                await updateUnit(unit.id, { currentOccupants: newOcc, status: newOcc === 0 ? "vacant" : "occupied" });
                await createOccupancyRecord({ residentType: "egyptian", residentId: egyptian.id, residentName: egyptian.name, unitId: unit.id, unitCode: unit.code, action: "check_out", actionDate: checkOutDate, notes: row.reason });
                found = true;
              }
            } else {
              const russian = await findRussianByNameAndUnit(row.name, unit.id);
              if (russian) {
                await updateRussianResident(russian.id, { status: "checked_out", checkOutDate, unitId: null as any });
                const newOcc = Math.max(0, unit.currentOccupants - 1);
                await updateUnit(unit.id, { currentOccupants: newOcc, status: newOcc === 0 ? "vacant" : "occupied" });
                await createOccupancyRecord({ residentType: "russian", residentId: russian.id, residentName: russian.name, unitId: unit.id, unitCode: unit.code, action: "check_out", actionDate: checkOutDate, notes: row.reason });
                found = true;
              }
            }
          }

          if (!found) throw new Error("لم يتم العثور على الساكن");
          successCount++;
        } catch (err: any) {
          failedCount++;
          errors.push({ row: i + 1, error: err.message || "خطأ غير معروف" });
        }
      }

      await updateImportLog(logId, {
        successRows: successCount,
        failedRows: failedCount,
        errors: errors as any,
        status: failedCount === input.rows.length ? "failed" : "completed",
      });

      await createNotification({
        title: "إخلاء جماعي",
        message: `تم إخلاء ${successCount} ساكن بنجاح${failedCount > 0 ? ` (فشل ${failedCount})` : ""}`,
        type: failedCount === 0 ? "success" : "warning",
      });

      return { success: true, logId, successCount, failedCount, errors };
    }),
  }),

  // ===== BULK CHECK-IN =====
  bulkCheckIn: router({
    egyptian: protectedProcedure.input(z.object({
      residents: z.array(z.object({
        name: z.string().min(1),
        nationalId: z.string().min(1),
        phone: z.string().optional(),
        shift: z.string().optional(),
        ocrConfidence: z.number().optional(),
      })),
      unitId: z.number(),
      checkInDate: z.number().optional(),
    })).mutation(async ({ input }) => {
      const unit = await getUnitById(input.unitId);
      if (!unit) throw new Error("الوحدة غير موجودة");
      if (unit.type !== "apartment") throw new Error("المصريون يسكنون في الشقق فقط");

      const availableBeds = unit.beds - unit.currentOccupants;
      if (input.residents.length > availableBeds) throw new Error(`لا توجد أسرة كافية. المتاح: ${availableBeds}, المطلوب: ${input.residents.length}`);

      const checkInDate = input.checkInDate || Date.now();
      let count = 0;

      for (const r of input.residents) {
        const residentId = await createEgyptianResident({
          name: r.name,
          nationalId: r.nationalId,
          phone: r.phone,
          shift: r.shift,
          unitId: unit.id,
          checkInDate,
          status: "active",
          ocrConfidence: r.ocrConfidence,
        });

        await createOccupancyRecord({
          residentType: "egyptian",
          residentId,
          residentName: r.name,
          unitId: unit.id,
          unitCode: unit.code,
          action: "check_in",
          actionDate: checkInDate,
        });
        count++;
      }

      await updateUnit(unit.id, {
        currentOccupants: unit.currentOccupants + count,
        status: "occupied",
      });

      await createNotification({
        title: "تسكين جماعي",
        message: `تم تسكين ${count} أشخاص في ${unit.code}`,
        type: "success",
      });

      return { success: true, count };
    }),

    russian: protectedProcedure.input(z.object({
      residents: z.array(z.object({
        name: z.string().min(1),
        passportNumber: z.string().min(1),
        nationality: z.string().default("Russian"),
        gender: z.enum(["male", "female"]),
        phone: z.string().optional(),
        shift: z.string().optional(),
        ocrConfidence: z.number().optional(),
      })),
      unitId: z.number(),
      checkInDate: z.number().optional(),
    })).mutation(async ({ input }) => {
      const unit = await getUnitById(input.unitId);
      if (!unit) throw new Error("الوحدة غير موجودة");
      if (unit.type !== "chalet") throw new Error("الروس يسكنون في الشاليهات فقط");

      const availableBeds = unit.beds - unit.currentOccupants;
      if (input.residents.length > availableBeds) throw new Error(`لا توجد أسرة كافية. المتاح: ${availableBeds}, المطلوب: ${input.residents.length}`);

      const checkInDate = input.checkInDate || Date.now();
      let count = 0;

      for (const r of input.residents) {
        const residentId = await createRussianResident({
          name: r.name,
          passportNumber: r.passportNumber,
          nationality: r.nationality,
          gender: r.gender,
          phone: r.phone,
          shift: r.shift,
          unitId: unit.id,
          checkInDate,
          status: "active",
          ocrConfidence: r.ocrConfidence,
        });

        await createOccupancyRecord({
          residentType: "russian",
          residentId,
          residentName: r.name,
          unitId: unit.id,
          unitCode: unit.code,
          action: "check_in",
          actionDate: checkInDate,
        });
        count++;
      }

      await updateUnit(unit.id, {
        currentOccupants: unit.currentOccupants + count,
        status: "occupied",
      });

      await createNotification({
        title: "تسكين جماعي",
        message: `تم تسكين ${count} أشخاص في ${unit.code}`,
        type: "success",
      });

      return { success: true, count };
    }),
  }),

  // ===== DASHBOARD =====
  dashboard: router({
    stats: publicProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).query(async ({ input }) => {
      return getDashboardStats(input?.sectorId);
    }),
    recentActivity: publicProcedure.query(async () => {
      return getRecentOccupancyRecords(10);
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
      const existing = await getSectorByCode(input.code);
      if (existing) throw new Error("\u0643\u0648\u062f \u0627\u0644\u0642\u0637\u0627\u0639 \u0645\u0648\u062c\u0648\u062f \u0645\u0633\u0628\u0642\u0627\u064b");
      const id = await createSector(input);
      return { success: true, id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      code: z.string().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSector(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteSector(input.id);
      return { success: true };
    }),
    assignUser: protectedProcedure.input(z.object({
      userId: z.number(),
      sectorId: z.number().nullable(),
    })).mutation(async ({ input }) => {
      await assignUserToSector(input.userId, input.sectorId);
      return { success: true };
    }),
    users: publicProcedure.query(async () => {
      return getAllUsers();
    }),
  }),

  // ===== NOTIFICATIONS PAGE =====
  notificationsPage: router({
    list: publicProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).query(async ({ input }) => {
      return getAllNotifications(input?.sectorId);
    }),
    unread: publicProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).query(async ({ input }) => {
      return getUnreadNotifications(input?.sectorId);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await markNotificationRead(input.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.input(z.object({ sectorId: z.number().optional() }).optional()).mutation(async ({ input }) => {
      await markAllNotificationsRead(input?.sectorId);
      return { success: true };
    }),
  }),

  // ===== REPORTS =====
  reports: router({
    occupancy: publicProcedure.query(async () => {
      const stats = await getDashboardStats();
      const records = await getAllOccupancyRecords();
      return { stats, records };
    }),
    aiInsights: protectedProcedure.input(z.object({
      stats: z.any(),
    })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `أنت محلل بيانات ذكي متخصص في إدارة التسكين. قدم رؤى وتوصيات بناءً على الإحصائيات المقدمة. اكتب بالعربية بشكل مختصر ومفيد. قدم 3-5 رؤى رئيسية.`
          },
          {
            role: "user",
            content: `حلل هذه الإحصائيات وقدم رؤى ذكية:\n${JSON.stringify(input.stats, null, 2)}`
          }
        ],
      });
      return { insights: response.choices[0].message.content as string };
    }),
  }),

  // ===== NOTIFICATIONS =====
  notifications: router({
    unread: publicProcedure.query(async () => {
      return getUnreadNotifications();
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await markNotificationRead(input.id);
      return { success: true };
    }),
  }),

  // ===== OCCUPANCY RECORDS =====
  occupancyRecords: router({
    list: publicProcedure.query(async () => {
      return getAllOccupancyRecords();
    }),
    recent: publicProcedure.input(z.object({ limit: z.number().default(20) }).optional()).query(async ({ input }) => {
      return getRecentOccupancyRecords(input?.limit || 20);
    }),
  }),

  // ===== IMPORT UNITS =====
  importUnits: router({
    process: protectedProcedure.input(z.object({
      sectorId: z.number().optional(),
      units: z.array(z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        type: z.enum(["apartment", "chalet"]),
        floor: z.string().optional(),
        rooms: z.number().optional(),
        beds: z.number().min(1),
        notes: z.string().optional(),
      })),
    })).mutation(async ({ input }) => {
      let created = 0;
      let skipped = 0;
      const errors: { code: string; error: string }[] = [];

      for (const u of input.units) {
        try {
          const existing = await getUnitByCode(u.code);
          if (existing) {
            skipped++;
            errors.push({ code: u.code, error: "الكود موجود مسبقاً" });
            continue;
          }
          await createUnit({
            code: u.code,
            name: u.name,
            type: u.type,
            sectorId: input.sectorId || null,
            floor: u.floor || null,
            rooms: u.rooms ?? 1,
            beds: u.beds,
            currentOccupants: 0,
            status: "vacant",
            notes: u.notes || null,
          });
          created++;
        } catch (err: any) {
          errors.push({ code: u.code, error: err.message || "خطأ غير متوقع" });
        }
      }

      if (created > 0) {
        await createNotification({
          title: "استيراد وحدات",
          message: `تم استيراد ${created} وحدة سكنية بنجاح`,
          type: "success",
          sectorId: input.sectorId || null,
        });
      }

      return { success: true, created, skipped, errors };
    }),
  }),
});

export type AppRouter = typeof appRouter;

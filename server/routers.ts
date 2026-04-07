import { createRouter } from '_core/trpc';
import { ocrRouter } from '_core/ocrRouter';
import db from 'db';

export const housingRouter = createRouter()
  .merge('ocr.', ocrRouter)
  .query('findResidents', {
    resolve({ ctx }) {
      return db.residents.findMany({ where: { active: true } });
    }
  })
  .mutation('bulkCheckIn', {
    input: z.array(z.object({ id: z.string() })),
    resolve({ input }) {
      return db.residents.updateMany({
        where: { id: { in: input.map(res => res.id) } },
        data: { status: 'checked-in' }
      });
    }
  })
  .query('getUnits', {
    resolve() {
      return db.units.findMany();
    }
  });

export const ocrAndHousingRouter = createRouter() 
  .merge('housing.', housingRouter);
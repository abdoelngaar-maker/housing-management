import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, Users, BedDouble, DoorOpen, Loader2, UserMinus, UserPlus } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function UnitDetails() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const unitId = parseInt(params.id || "0");

  const { data: unit, isLoading } = trpc.units.getById.useQuery({ id: unitId }, { enabled: unitId > 0 });
  const { data: residents, isLoading: residentsLoading } = trpc.units.getResidents.useQuery({ unitId }, { enabled: unitId > 0 });
  const deleteUnit = trpc.units.delete.useMutation({
  onSuccess: () => {
    toast.success("تم حذف الوحدة بنجاح");
    setLocation("/units");
  },
  onError: (err) => toast.error(err.message),
});
  const handleDeleteUnit = () => {
  if (!confirm("هل أنت متأكد من حذف الوحدة؟ لا يمكن التراجع عن هذا الإجراء")) return;

  deleteUnit.mutate({ id: unitId });
};
  const utils = trpc.useUtils();

  const checkOutEgyptian = trpc.egyptianResidents.checkOut.useMutation({
    onSuccess: () => {
      toast.success("تم إخلاء الساكن بنجاح");
      utils.units.getById.invalidate({ id: unitId });
      utils.units.getResidents.invalidate({ unitId });
    },
    onError: (err) => toast.error(err.message),
  });

  const checkOutRussian = trpc.russianResidents.checkOut.useMutation({
    onSuccess: () => {
      toast.success("تم إخلاء الساكن بنجاح");
      utils.units.getById.invalidate({ id: unitId });
      utils.units.getResidents.invalidate({ unitId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="text-center py-16">
        <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">الوحدة غير موجودة</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/units")}>
          <ArrowRight className="h-4 w-4 ml-2" />
          العودة للوحدات
        </Button>
      </div>
    );
  }

  const isApartment = unit.type === "apartment";
  const borderColor = isApartment ? "border-r-blue-500" : "border-r-red-500";
  const availableBeds = unit.beds - unit.currentOccupants;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/units")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{unit.name}</h1>
          <p className="text-muted-foreground text-sm">تفاصيل الوحدة السكنية</p>
        </div>
      </div>

      {/* Unit Info Card */}
      <Card className={`border-r-4 ${borderColor}`}>
        <CardContent className="pt-6">
    <div className="flex gap-2 mt-4">
  <Button onClick={() => setLocation("/check-in")} size="sm">
    <UserPlus className="h-4 w-4 ml-1" />
    تسكين جديد
  </Button>

  <Button variant="outline" onClick={() => setLocation("/transfer")} size="sm">
    نقل ساكنين
  </Button>

  <Button
    variant="destructive"
    size="sm"
    onClick={handleDeleteUnit}
    disabled={deleteUnit.isPending}
  >
    {deleteUnit.isPending ? (
      <Loader2 className="h-4 w-4 animate-spin ml-1" />
    ) : null}
    حذف الوحدة
  </Button>
</div>
            <div>
              <p className="text-sm text-muted-foreground">الكود</p>
              <p className="text-lg font-bold text-card-foreground">{unit.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">النوع</p>
              <Badge className={isApartment ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-0" : "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-0"}>
                {isApartment ? "شقة" : "شاليه"}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الطابق</p>
              <p className="text-lg font-bold text-card-foreground">{unit.floor || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الحالة</p>
              <Badge className={
                unit.status === "vacant" ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-0" :
                unit.status === "occupied" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-0" :
                "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-0"
              }>
                {unit.status === "vacant" ? "فارغة" : unit.status === "occupied" ? "مشغولة" : "صيانة"}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <DoorOpen className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-card-foreground">{unit.rooms}</p>
              <p className="text-xs text-muted-foreground">غرف</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <BedDouble className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-card-foreground">{unit.beds}</p>
              <p className="text-xs text-muted-foreground">أسرة</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <Users className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-card-foreground">{unit.currentOccupants}/{unit.beds}</p>
              <p className="text-xs text-muted-foreground">سكان</p>
            </div>
          </div>

          {/* Capacity bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>الإشغال</span>
              <span>{availableBeds} أسرة متاحة</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  availableBeds === 0 ? "bg-red-500" : availableBeds <= 2 ? "bg-orange-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(100, (unit.currentOccupants / unit.beds) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => setLocation("/check-in")} size="sm">
              <UserPlus className="h-4 w-4 ml-1" />
              تسكين جديد
            </Button>
            <Button variant="outline" onClick={() => setLocation("/transfer")} size="sm">
              نقل ساكنين
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Residents List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            السكان الحاليون ({(residents?.egyptians?.length || 0) + (residents?.russians?.length || 0)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {residentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {residents?.egyptians?.map((r) => (
                <div key={`eg-${r.id}`} className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🇪🇬</span>
                    <div>
                      <p className="font-medium text-sm text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">رقم قومي: {r.nationalId}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => checkOutEgyptian.mutate({ id: r.id })}
                    disabled={checkOutEgyptian.isPending}
                  >
                    <UserMinus className="h-4 w-4 ml-1" />
                    إخلاء
                  </Button>
                </div>
              ))}
              {residents?.russians?.map((r) => (
                <div key={`ru-${r.id}`} className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🇷🇺</span>
                    <div>
                      <p className="font-medium text-sm text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">جواز: {r.passportNumber} | {r.gender === "male" ? "ذكر" : "أنثى"}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => checkOutRussian.mutate({ id: r.id })}
                    disabled={checkOutRussian.isPending}
                  >
                    <UserMinus className="h-4 w-4 ml-1" />
                    إخلاء
                  </Button>
                </div>
              ))}
              {(!residents?.egyptians?.length && !residents?.russians?.length) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>لا يوجد سكان حالياً في هذه الوحدة</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

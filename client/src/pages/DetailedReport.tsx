import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Building2, User, Phone, Calendar, ArrowRightLeft, Trash2, FileText, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function DetailedReport() {
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const { data: report, isLoading, error } = trpc.units.detailedReport.useQuery(undefined, {
    refetchInterval: 30000,
    retry: 1
  });

  const deleteMutation = trpc.units.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الوحدة بنجاح");
      utils.units.detailedReport.invalidate();
    },
    onError: (err) => toast.error("فشل الحذف: " + err.message),
  });

  const filteredReport = useMemo(() => {
    if (!report || !Array.isArray(report)) return [];
    if (!search) return report;
    const s = search.toLowerCase();
    return report.filter(u => 
      (u.code && String(u.code).toLowerCase().includes(s)) || 
      (u.name && String(u.name).toLowerCase().includes(s)) || 
      (u.ownerName && String(u.ownerName).toLowerCase().includes(s)) ||
      (u.buildingName && String(u.buildingName).toLowerCase().includes(s)) ||
      (u.residents && u.residents.some((r: any) => r.name && String(r.name).toLowerCase().includes(s)))
    );
  }, [report, search]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    try {
      const date = new Date(Number(timestamp));
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) {
      return "-";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">جاري تحميل السجل التفصيلي...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center text-red-500 bg-red-50 rounded-lg border border-red-200 m-6">
        <h3 className="text-lg font-bold mb-2">حدث خطأ أثناء تحميل البيانات</h3>
        <p>{error.message}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>إعادة المحاولة</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            سجل الوحدات التفصيلي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">عرض شامل لكل الوحدات، الملاك، والساكنين (الحاليين والسابقين)</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            تصدير PDF
          </Button>
        </div>
      </div>

      <Card className="border-primary/10 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بكود الوحدة، اسم الساكن، المالك، أو العقار..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-11 text-right"
              dir="rtl"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {filteredReport && filteredReport.length > 0 ? (
          filteredReport.map((unit) => (
            <Card key={unit.id} className="overflow-hidden border-r-4 border-r-primary shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-muted/30 py-4 border-b">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        {unit.code}
                        <Badge variant="outline" className="text-xs font-normal">
                          {unit.type === "apartment" ? "شقة" : "شاليه"}
                        </Badge>
                        {unit.status === "vacant" ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-200">فارغة</Badge>
                        ) : (
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-200">مشغولة</Badge>
                        )}
                      </CardTitle>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">العقار: <b className="text-foreground">{unit.buildingName || "-"}</b></span>
                        <span className="flex items-center gap-1">المالك: <b className="text-foreground">{unit.ownerName || "-"}</b></span>
                        <span className="flex items-center gap-1">القطاع: <b className="text-foreground">{unit.sectorName}</b></span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1" disabled={unit.currentOccupants > 0}>
                          <Trash2 className="h-4 w-4" />
                          حذف الوحدة
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>هل أنت متأكد من حذف الوحدة {unit.code}؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الوحدة وكل سجلاتها بشكل نهائي.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate({ id: unit.id })}>
                            تأكيد الحذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="p-4 border-l">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-primary">
                      <User className="h-4 w-4" />
                      الساكنون الحاليون ({unit.residents?.length || 0})
                    </h4>
                    {unit.residents && unit.residents.length > 0 ? (
                      <div className="space-y-3">
                        {unit.residents.map((r: any) => (
                          <div key={r.id} className="bg-muted/40 p-3 rounded-lg border flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="font-bold text-sm">{r.name}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {r.nationalId || r.passportNumber}</span>
                                {r.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {r.phone}</span>}
                                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> تسكين: {formatDate(r.checkInDate)}</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-[10px] h-5">
                              {r.type === "egyptian" ? "مصري" : "روسي"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                        <p className="text-muted-foreground text-sm italic">لا يوجد سكان حالياً</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-muted/5">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-muted-foreground">
                      <ArrowRightLeft className="h-4 w-4" />
                      سجل المغادرين
                    </h4>
                    {unit.pastResidents && unit.pastResidents.length > 0 ? (
                      <div className="max-h-[200px] overflow-y-auto pr-2 space-y-2">
                        <table className="w-full text-right">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b">
                              <th className="pb-2 font-medium">الاسم</th>
                              <th className="pb-2 font-medium">تاريخ الرفد</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unit.pastResidents.map((record: any) => (
                              <tr key={record.id} className="border-b border-muted/20 last:border-0">
                                <td className="py-2 text-xs font-medium">{record.residentName}</td>
                                <td className="py-2 text-xs text-muted-foreground">{formatDate(record.actionDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 opacity-50">
                        <p className="text-xs italic">لا يوجد سجل مغادرة سابق</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
            <Building2 className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">لم يتم العثور على وحدات تطابق بحثك</h3>
          </div>
        )}
      </div>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle,
  Download, LogOut, Trash2, Calendar,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface EvictionRow {
  name: string;
  nationalId?: string;
  unitCode?: string;
  checkOutDate?: string;
  reason?: string;
}

export default function Eviction() {
  const [parsedRows, setParsedRows] = useState<EvictionRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [evictionResult, setEvictionResult] = useState<{
    successCount: number;
    failedCount: number;
    errors: { row: number; error: string }[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const evictionMutation = trpc.eviction.process.useMutation({
    onSuccess: (data) => {
      setEvictionResult(data);
      if (data.failedCount === 0) {
        toast.success(`تم إخلاء ${data.successCount} ساكن بنجاح`);
      } else {
        toast.warning(`تم إخلاء ${data.successCount} ساكن، فشل ${data.failedCount}`);
      }
      utils.dashboard.stats.invalidate();
      utils.units.list.invalidate();
      utils.import.logs.invalidate();
    },
    onError: (err) => toast.error("فشل في الإخلاء: " + err.message),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setEvictionResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        const rows: EvictionRow[] = jsonData.map((row: any) => ({
          name: row["الاسم"] || row["name"] || row["Name"] || "",
          nationalId: row["الرقم القومي"] || row["رقم الجواز"] || row["nationalId"] || row["passportNumber"] || row["ID"] || "",
          unitCode: row["كود الوحدة"] || row["unitCode"] || row["Unit"] || "",
          checkOutDate: row["تاريخ الإخلاء"] || row["checkOutDate"] || row["Date"] || "",
          reason: row["السبب"] || row["reason"] || row["Reason"] || "",
        }));

        setParsedRows(rows);
        toast.success(`تم قراءة ${rows.length} سجل من الملف`);
      } catch (err) {
        toast.error("فشل في قراءة الملف");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleProcess = () => {
    if (parsedRows.length === 0) {
      toast.error("لا توجد بيانات للمعالجة");
      return;
    }
    evictionMutation.mutate({ rows: parsedRows, fileName });
  };

  const removeRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["الاسم", "الرقم القومي", "كود الوحدة", "تاريخ الإخلاء", "السبب"],
      ["أحمد محمد", "29901011234567", "A-1011", "2026-02-08", "انتهاء العقد"],
      ["Ivan Petrov", "AB1234567", "C-01", "2026-02-08", "نقل مشروع"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "إخلاء");
    XLSX.writeFile(wb, "eviction_template.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LogOut className="h-7 w-7 text-red-500" />
            إخلاء ساكنين
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            إخلاء ساكنين بتاريخ محدد عبر استيراد ملف Excel
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate} className="gap-2">
          <Download className="h-4 w-4" />
          تحميل القالب
        </Button>
      </div>

      {/* Upload Area */}
      <Card>
        <CardContent className="pt-6">
          <div
            className="border-2 border-dashed border-red-300 dark:border-red-700 rounded-xl p-8 text-center hover:border-red-500 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            <FileSpreadsheet className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-foreground">
              {fileName || "اضغط لرفع ملف الإخلاء"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              يدعم: Excel (.xlsx, .xls) و CSV
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              الأعمدة المطلوبة: الاسم، الرقم القومي/رقم الجواز، كود الوحدة، تاريخ الإخلاء، السبب
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-red-500" />
                معاينة بيانات الإخلاء ({parsedRows.length} سجل)
              </span>
              <Button
                onClick={handleProcess}
                disabled={evictionMutation.isPending}
                variant="destructive"
                className="gap-2"
              >
                {evictionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                تنفيذ الإخلاء
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-10">#</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الرقم القومي/الجواز</TableHead>
                    <TableHead className="text-right">كود الوحدة</TableHead>
                    <TableHead className="text-right">تاريخ الإخلاء</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="font-mono text-sm">{row.nationalId || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.unitCode || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.checkOutDate || "اليوم"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.reason || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeRow(i)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {evictionResult && (
        <Card className={evictionResult.failedCount === 0 ? "border-green-200" : "border-orange-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              {evictionResult.failedCount === 0 ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-orange-600" />
              )}
              <div>
                <p className="font-medium">نتائج الإخلاء</p>
                <p className="text-sm text-muted-foreground">
                  نجح: {evictionResult.successCount} | فشل: {evictionResult.failedCount}
                </p>
              </div>
            </div>

            {evictionResult.errors.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium text-red-600">الأخطاء:</p>
                {evictionResult.errors.map((err, i) => (
                  <div key={i} className="flex gap-2 text-sm bg-red-50 dark:bg-red-950/30 p-2 rounded">
                    <Badge variant="outline" className="text-xs">صف {err.row}</Badge>
                    <span className="text-red-600">{err.error}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

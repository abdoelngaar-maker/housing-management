import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUp, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Download, Table2, Clock } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ImportRow = {
  name: string;
  nationalId: string;
  phone: string;
  checkInDate: string;
  unitCode: string;
  shift: string;
  checkOutDate: string;
};

export default function Import() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: importLogs, isLoading: logsLoading } = trpc.import.logs.useQuery();
  const utils = trpc.useUtils();

  const importMutation = trpc.import.process.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      if (data.failedCount === 0) {
        toast.success(`تم استيراد ${data.successCount} سجل بنجاح`);
      } else {
        toast.warning(`تم استيراد ${data.successCount} سجل، فشل ${data.failedCount} سجل`);
      }
      utils.import.logs.invalidate();
      utils.dashboard.stats.invalidate();
      utils.units.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        const mapped: ImportRow[] = jsonData.map((row: any) => ({
          name: String(row["الاسم"] || row["name"] || row["Name"] || "").trim(),
          nationalId: String(row["الرقم القومي"] || row["nationalId"] || row["National ID"] || row["ID"] || "").trim(),
          phone: String(row["الهاتف"] || row["phone"] || row["Phone"] || "").trim(),
          checkInDate: String(row["تاريخ التسكين"] || row["checkInDate"] || row["Check In"] || "").trim(),
          unitCode: String(row["كود الوحدة"] || row["unitCode"] || row["Unit Code"] || row["Unit"] || "").trim(),
          shift: String(row["الشيفت"] || row["shift"] || row["Shift"] || "").trim(),
          checkOutDate: String(row["تاريخ الرفد"] || row["checkOutDate"] || row["Check Out"] || "").trim(),
        }));

        setRows(mapped.filter(r => r.name));
        toast.success(`تم تحميل ${mapped.filter(r => r.name).length} سجل من الملف`);
      } catch (err) {
        toast.error("فشل في قراءة الملف");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleImport = () => {
    if (rows.length === 0) { toast.error("لا توجد بيانات للاستيراد"); return; }
    importMutation.mutate({ rows, fileName });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "الاسم": "أحمد محمد", "الرقم القومي": "29901011234567", "الهاتف": "01012345678", "تاريخ التسكين": "2025-01-15", "كود الوحدة": "A-1011", "الشيفت": "صباحي", "تاريخ الرفد": "" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "بيانات");
    XLSX.writeFile(wb, "قالب_الاستيراد.xlsx");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">استيراد بيانات</h1>
        <p className="text-muted-foreground text-sm mt-1">استيراد بيانات الموظفين من ملفات Excel أو CSV</p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            رفع ملف البيانات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
            <FileUp className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">اسحب الملف هنا أو اضغط للرفع</p>
              <p className="text-xs text-muted-foreground mt-1">يدعم ملفات Excel (.xlsx, .xls) و CSV</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => fileInputRef.current?.click()}>
                <FileUp className="h-4 w-4 ml-2" />
                اختر ملف
              </Button>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 ml-2" />
                تحميل القالب
              </Button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
        </CardContent>
      </Card>

      {/* Preview */}
      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Table2 className="h-5 w-5" />
                معاينة البيانات
              </span>
              <Badge>{rows.length} سجل</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-right font-medium">#</th>
                    <th className="p-2 text-right font-medium">الاسم</th>
                    <th className="p-2 text-right font-medium">الرقم القومي</th>
                    <th className="p-2 text-right font-medium">الهاتف</th>
                    <th className="p-2 text-right font-medium">كود الوحدة</th>
                    <th className="p-2 text-right font-medium">الشيفت</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/30">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">{row.name}</td>
                      <td className="p-2 font-mono text-xs">{row.nationalId}</td>
                      <td className="p-2">{row.phone}</td>
                      <td className="p-2">
                        <Badge variant="outline">{row.unitCode}</Badge>
                      </td>
                      <td className="p-2">{row.shift}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  يتم عرض أول 20 سجل من {rows.length}
                </p>
              )}
            </div>

            <Button
              className="w-full mt-4"
              onClick={handleImport}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              استيراد {rows.length} سجل
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card className={importResult.failedCount === 0 ? "border-green-200" : "border-orange-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              {importResult.failedCount === 0 ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-orange-600" />
              )}
              <div>
                <p className="font-medium">نتائج الاستيراد</p>
                <p className="text-sm text-muted-foreground">
                  نجح: {importResult.successCount} | فشل: {importResult.failedCount}
                </p>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {importResult.errors.map((err: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <span>صف {err.row}: {err.error}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5" />
            سجل عمليات الاستيراد
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : importLogs && importLogs.length > 0 ? (
            <div className="space-y-2">
              {importLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{log.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800 border-0">{log.successRows} نجح</Badge>
                    {log.failedRows > 0 && (
                      <Badge className="bg-red-100 text-red-800 border-0">{log.failedRows} فشل</Badge>
                    )}
                    <Badge variant="outline">{log.status === "completed" ? "مكتمل" : log.status === "failed" ? "فشل" : "قيد التنفيذ"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد عمليات استيراد سابقة</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

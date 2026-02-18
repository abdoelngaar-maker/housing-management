import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Building2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedUnit {
  code: string;
  name: string;
  type: "apartment" | "chalet";
  floor?: string;
  rooms?: number;
  beds: number;
  notes?: string;
}

export default function ImportUnits() {
  const [parsedUnits, setParsedUnits] = useState<ParsedUnit[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: sectors = [] } = trpc.sectors.list.useQuery();
  const utils = trpc.useUtils();

  const importMutation = trpc.importUnits.process.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.units.list.invalidate();
      utils.dashboard.stats.invalidate();
      if (data.created > 0) toast.success(`تم استيراد ${data.created} وحدة بنجاح`);
      if (data.skipped > 0) toast.warning(`تم تخطي ${data.skipped} وحدة (أكواد مكررة)`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        const units: ParsedUnit[] = rows.map((row) => {
          const typeRaw = (row["النوع"] || row["type"] || "").toString().toLowerCase();
          const type: "apartment" | "chalet" = typeRaw.includes("شاليه") || typeRaw.includes("chalet") ? "chalet" : "apartment";
          return {
            code: (row["الكود"] || row["code"] || "").toString().trim(),
            name: (row["الاسم"] || row["name"] || "").toString().trim(),
            type,
            floor: (row["الطابق"] || row["floor"] || "").toString().trim() || undefined,
            rooms: parseInt(row["الغرف"] || row["rooms"] || "1") || 1,
            beds: parseInt(row["الأسرة"] || row["beds"] || "1") || 1,
            notes: (row["ملاحظات"] || row["notes"] || "").toString().trim() || undefined,
          };
        }).filter(u => u.code && u.name);

        setParsedUnits(units);
        if (units.length === 0) toast.error("لم يتم العثور على بيانات صالحة في الملف");
        else toast.success(`تم قراءة ${units.length} وحدة من الملف`);
      } catch {
        toast.error("خطأ في قراءة الملف");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["الكود", "الاسم", "النوع", "الطابق", "الغرف", "الأسرة", "ملاحظات"],
      ["S300-1", "شقة S300-1", "شقة", "1", "2", "4", ""],
      ["S300-2", "شقة S300-2", "شقة", "1", "2", "4", ""],
      ["S300-3", "شقة S300-3", "شقة", "2", "3", "6", ""],
      ["C-01", "شاليه C-01", "شاليه", "أرضي", "3", "6", ""],
    ]);
    ws["!cols"] = [{ wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الوحدات");
    XLSX.writeFile(wb, "قالب_استيراد_الوحدات.xlsx");
  };

  const handleImport = () => {
    if (parsedUnits.length === 0) return;
    importMutation.mutate({
      sectorId: selectedSector ? Number(selectedSector) : undefined,
      units: parsedUnits,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">استيراد الوحدات السكنية</h1>
        <p className="text-muted-foreground mt-1">استيراد الوحدات من ملف Excel مع تحديد القطاع</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> رفع ملف Excel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>القطاع</Label>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger><SelectValue placeholder="اختر القطاع (اختياري)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قطاع</SelectItem>
                  {sectors.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">{fileName || "اضغط لاختيار ملف Excel أو CSV"}</p>
              <p className="text-sm text-muted-foreground mt-1">يدعم .xlsx و .xls و .csv</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </div>

            <Button variant="outline" onClick={downloadTemplate} className="w-full">
              <Download className="ml-2 h-4 w-4" /> تحميل قالب Excel
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تعليمات الاستيراد</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p>1. حمّل قالب Excel واملأ البيانات</p>
            <p>2. الأعمدة المطلوبة: <strong className="text-foreground">الكود، الاسم، النوع، الأسرة</strong></p>
            <p>3. النوع: اكتب "شقة" أو "شاليه"</p>
            <p>4. الكود يجب أن يكون فريداً لكل وحدة</p>
            <p>5. مثال نظام الأكواد:</p>
            <div className="bg-muted rounded p-2 font-mono text-xs space-y-1">
              <p>S300-1 → شقة 1 في عمارة S300</p>
              <p>S300-2 → شقة 2 في عمارة S300</p>
              <p>C-01 → شاليه رقم 1</p>
            </div>
            <p>6. اختر القطاع لربط الوحدات به</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview Table */}
      {parsedUnits.length > 0 && !result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                معاينة البيانات ({parsedUnits.length} وحدة)
              </CardTitle>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? "جاري الاستيراد..." : `استيراد ${parsedUnits.length} وحدة`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-right">#</th>
                    <th className="p-2 text-right">الكود</th>
                    <th className="p-2 text-right">الاسم</th>
                    <th className="p-2 text-right">النوع</th>
                    <th className="p-2 text-right">الطابق</th>
                    <th className="p-2 text-right">الغرف</th>
                    <th className="p-2 text-right">الأسرة</th>
                    <th className="p-2 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedUnits.map((u, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${u.type === "apartment" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {u.code}
                        </span>
                      </td>
                      <td className="p-2">{u.name}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${u.type === "apartment" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {u.type === "apartment" ? "شقة" : "شاليه"}
                        </span>
                      </td>
                      <td className="p-2">{u.floor || "-"}</td>
                      <td className="p-2">{u.rooms}</td>
                      <td className="p-2">{u.beds}</td>
                      <td className="p-2 text-muted-foreground">{u.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.errors?.length > 0 ? <AlertTriangle className="h-5 w-5 text-yellow-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
              نتائج الاستيراد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                <p className="text-sm text-green-700 dark:text-green-400">تم الاستيراد</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">تم التخطي</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{result.errors?.length || 0}</p>
                <p className="text-sm text-red-700 dark:text-red-400">أخطاء</p>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">تفاصيل الأخطاء:</h4>
                {result.errors.map((err: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="font-mono font-bold">{err.code}</span>
                    <span className="text-muted-foreground">- {err.error}</span>
                  </div>
                ))}
              </div>
            )}

            <Button className="mt-4" variant="outline" onClick={() => { setParsedUnits([]); setResult(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}>
              استيراد ملف آخر
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

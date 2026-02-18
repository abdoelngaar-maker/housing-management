import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, ScanLine, Building2, Plus, Trash2, Users, Clock, Search } from "lucide-react";
import { useState, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";

type EgyptianEntry = { name: string; nationalId: string; phone: string; confidence: number; selected: boolean };
type RussianEntry = { name: string; passportNumber: string; nationality: string; gender: "male" | "female"; phone: string; confidence: number; selected: boolean };

export default function BulkCheckIn() {
  const [activeTab, setActiveTab] = useState("egyptian");
  const [isScanning, setIsScanning] = useState(false);
  const [egyptianEntries, setEgyptianEntries] = useState<EgyptianEntry[]>([]);
  const [russianEntries, setRussianEntries] = useState<RussianEntry[]>([]);
  const [unitId, setUnitId] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [bulkShift, setBulkShift] = useState("");
  const [bulkCheckInDate, setBulkCheckInDate] = useState(() => new Date().toISOString().slice(0, 16));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shiftOptions = [
    { value: "morning", label: "صباحي (6ص - 2م)" },
    { value: "evening", label: "مسائي (2م - 10م)" },
    { value: "night", label: "ليلي (10م - 6ص)" },
    { value: "day_12h", label: "نهاري 12 ساعة (6ص - 6م)" },
    { value: "night_12h", label: "ليلي 12 ساعة (6م - 6ص)" },
  ];

  const unitType = useMemo(() => activeTab === "egyptian" ? "apartment" : "chalet", [activeTab]);
  const { data: units } = trpc.units.list.useQuery({ type: unitType, status: "all" });
  const availableUnits = useMemo(() => {
    const filtered = units?.filter(u => u.currentOccupants < u.beds) || [];
    if (!unitSearch.trim()) return filtered;
    const q = unitSearch.toLowerCase();
    return filtered.filter(u => u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [units, unitSearch]);
  const selectedUnit = useMemo(() => availableUnits.find(u => u.id.toString() === unitId), [availableUnits, unitId]);

  const utils = trpc.useUtils();

  const scanEgyptian = trpc.ocr.scanEgyptianId.useMutation({
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        const newEntries = data.results.map((r: any) => ({
          name: r.name, nationalId: r.nationalId, phone: "", confidence: r.confidence, selected: true,
        }));
        setEgyptianEntries(prev => [...prev, ...newEntries]);
        toast.success(`تم استخراج ${data.results.length} بطاقة`);
      }
      setIsScanning(false);
    },
    onError: (err) => { toast.error("فشل في الاستخراج: " + err.message); setIsScanning(false); },
  });

  const scanRussian = trpc.ocr.scanRussianPassport.useMutation({
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        const newEntries = data.results.map((r: any) => ({
          name: r.name, passportNumber: r.passportNumber, nationality: r.nationality, gender: r.gender, phone: "", confidence: r.confidence, selected: true,
        }));
        setRussianEntries(prev => [...prev, ...newEntries]);
        toast.success(`تم استخراج ${data.results.length} جواز`);
      }
      setIsScanning(false);
    },
    onError: (err) => { toast.error("فشل في الاستخراج: " + err.message); setIsScanning(false); },
  });

  const bulkCheckInEgyptian = trpc.bulkCheckIn.egyptian.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تسكين ${data.count} أشخاص بنجاح`);
      setEgyptianEntries([]); setUnitId("");
      utils.units.list.invalidate(); utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkCheckInRussian = trpc.bulkCheckIn.russian.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تسكين ${data.count} أشخاص بنجاح`);
      setRussianEntries([]); setUnitId("");
      utils.units.list.invalidate(); utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setIsScanning(true);
      if (activeTab === "egyptian") scanEgyptian.mutate({ imageBase64: base64 });
      else scanRussian.mutate({ imageBase64: base64 });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [activeTab]);

  const addManualEgyptian = () => {
    setEgyptianEntries(prev => [...prev, { name: "", nationalId: "", phone: "", confidence: 100, selected: true }]);
  };

  const addManualRussian = () => {
    setRussianEntries(prev => [...prev, { name: "", passportNumber: "", nationality: "Russian", gender: "male", phone: "", confidence: 100, selected: true }]);
  };

  const handleBulkSubmit = () => {
    if (!unitId) { toast.error("يرجى اختيار الوحدة السكنية"); return; }

    if (activeTab === "egyptian") {
      const selected = egyptianEntries.filter(e => e.selected && e.name && e.nationalId);
      if (selected.length === 0) { toast.error("يرجى اختيار شخص واحد على الأقل"); return; }
      bulkCheckInEgyptian.mutate({
        residents: selected.map(e => ({ name: e.name, nationalId: e.nationalId, phone: e.phone || undefined, shift: bulkShift || undefined, ocrConfidence: e.confidence })),
        unitId: parseInt(unitId),
        checkInDate: new Date(bulkCheckInDate).getTime(),
      });
    } else {
      const selected = russianEntries.filter(e => e.selected && e.name && e.passportNumber);
      if (selected.length === 0) { toast.error("يرجى اختيار شخص واحد على الأقل"); return; }
      bulkCheckInRussian.mutate({
        residents: selected.map(e => ({ name: e.name, passportNumber: e.passportNumber, nationality: e.nationality, gender: e.gender, phone: e.phone || undefined, shift: bulkShift || undefined, ocrConfidence: e.confidence })),
        unitId: parseInt(unitId),
        checkInDate: new Date(bulkCheckInDate).getTime(),
      });
    }
  };

  const selectedCount = activeTab === "egyptian"
    ? egyptianEntries.filter(e => e.selected).length
    : russianEntries.filter(e => e.selected).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تسكين جماعي</h1>
        <p className="text-muted-foreground text-sm mt-1">تسكين عدة أشخاص في وحدة واحدة باستخدام المسح الضوئي</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setUnitId(""); }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="egyptian">🇪🇬 مصريون (شقة)</TabsTrigger>
          <TabsTrigger value="russian">🇷🇺 روس (شاليه)</TabsTrigger>
        </TabsList>

        {/* Scan Section */}
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="h-5 w-5" />
              مسح ضوئي جماعي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                <Upload className="h-4 w-4 ml-2" />
                رفع صورة
              </Button>
              <Button variant="outline" onClick={activeTab === "egyptian" ? addManualEgyptian : addManualRussian}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة يدوي
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            {isScanning && (
              <div className="mt-4 flex items-center justify-center gap-2 p-4 bg-primary/5 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-primary">جاري تحليل الصورة واستخراج البيانات...</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Egyptian Entries */}
        <TabsContent value="egyptian">
          {egyptianEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    البطاقات المستخرجة ({egyptianEntries.length})
                  </span>
                  <Badge>{selectedCount} محدد</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {egyptianEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <Checkbox
                      checked={entry.selected}
                      onCheckedChange={(checked) => {
                        const updated = [...egyptianEntries];
                        updated[idx].selected = !!checked;
                        setEgyptianEntries(updated);
                      }}
                      className="mt-2"
                    />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        placeholder="الاسم"
                        value={entry.name}
                        onChange={e => {
                          const updated = [...egyptianEntries];
                          updated[idx].name = e.target.value;
                          setEgyptianEntries(updated);
                        }}
                      />
                      <Input
                        placeholder="الرقم القومي"
                        value={entry.nationalId}
                        onChange={e => {
                          const updated = [...egyptianEntries];
                          updated[idx].nationalId = e.target.value;
                          setEgyptianEntries(updated);
                        }}
                      />
                      <Input
                        placeholder="الهاتف"
                        value={entry.phone}
                        onChange={e => {
                          const updated = [...egyptianEntries];
                          updated[idx].phone = e.target.value;
                          setEgyptianEntries(updated);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.confidence >= 80 ? "default" : "outline"} className={entry.confidence >= 80 ? "bg-green-600" : "bg-orange-500 text-white"}>
                        {entry.confidence}%
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setEgyptianEntries(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Russian Entries */}
        <TabsContent value="russian">
          {russianEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    الجوازات المستخرجة ({russianEntries.length})
                  </span>
                  <Badge>{selectedCount} محدد</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {russianEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <Checkbox
                      checked={entry.selected}
                      onCheckedChange={(checked) => {
                        const updated = [...russianEntries];
                        updated[idx].selected = !!checked;
                        setRussianEntries(updated);
                      }}
                      className="mt-2"
                    />
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input placeholder="الاسم" value={entry.name} onChange={e => { const u = [...russianEntries]; u[idx].name = e.target.value; setRussianEntries(u); }} />
                      <Input placeholder="رقم الجواز" value={entry.passportNumber} onChange={e => { const u = [...russianEntries]; u[idx].passportNumber = e.target.value; setRussianEntries(u); }} />
                      <Input placeholder="الجنسية" value={entry.nationality} onChange={e => { const u = [...russianEntries]; u[idx].nationality = e.target.value; setRussianEntries(u); }} />
                      <Select value={entry.gender} onValueChange={v => { const u = [...russianEntries]; u[idx].gender = v as any; setRussianEntries(u); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">ذكر</SelectItem>
                          <SelectItem value="female">أنثى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.confidence >= 80 ? "default" : "outline"} className={entry.confidence >= 80 ? "bg-green-600" : "bg-orange-500 text-white"}>
                        {entry.confidence}%
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setRussianEntries(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Unit Selection & Submit */}
      {(egyptianEntries.length > 0 || russianEntries.length > 0) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>الشيفت</Label>
                <Select value={bulkShift} onValueChange={setBulkShift}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الشيفت" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  تاريخ ووقت التسكين
                </Label>
                <Input type="datetime-local" value={bulkCheckInDate} onChange={e => setBulkCheckInDate(e.target.value)} dir="ltr" />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                الوحدة السكنية *
              </Label>
              <div className="relative mt-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input placeholder="ابحث بالكود أو الاسم..." value={unitSearch} onChange={e => setUnitSearch(e.target.value)} className="pr-9 mb-2" />
              </div>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder={activeTab === "egyptian" ? "اختر الشقة" : "اختر الشاليه"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableUnits.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs font-mono ${u.type === 'apartment' ? 'border-blue-300 text-blue-700' : 'border-red-300 text-red-700'}`}>{u.code}</Badge>
                        {u.name} (متاح: {u.beds - u.currentOccupants})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUnit && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>السعة الكلية: {selectedUnit.beds}</span>
                  <span>المشغول: {selectedUnit.currentOccupants}</span>
                  <span className={selectedUnit.beds - selectedUnit.currentOccupants >= selectedCount ? "text-green-600" : "text-red-600"}>
                    المتاح: {selectedUnit.beds - selectedUnit.currentOccupants}
                  </span>
                </div>
                {selectedUnit.beds - selectedUnit.currentOccupants < selectedCount && (
                  <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    عدد المحددين ({selectedCount}) أكبر من الأسرة المتاحة
                  </p>
                )}
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleBulkSubmit}
              disabled={bulkCheckInEgyptian.isPending || bulkCheckInRussian.isPending || selectedCount === 0}
            >
              {(bulkCheckInEgyptian.isPending || bulkCheckInRussian.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              تسكين {selectedCount} أشخاص
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

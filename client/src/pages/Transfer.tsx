import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeftRight, Building2, Users, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

type ResidentSelection = {
  id: number;
  type: "egyptian" | "russian";
  name: string;
  identifier: string;
  selected: boolean;
};

export default function Transfer() {
  const [fromUnitId, setFromUnitId] = useState("");
  const [toUnitId, setToUnitId] = useState("");
  const [residents, setResidents] = useState<ResidentSelection[]>([]);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");

  const { data: allUnits } = trpc.units.list.useQuery({});

  const occupiedUnits = useMemo(() => {
    const occupied = allUnits?.filter(u => u.currentOccupants > 0) || [];
    if (!fromSearch.trim()) return occupied;
    const q = fromSearch.toLowerCase();
    return occupied.filter(u =>
      u.code.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q)
    );
  }, [allUnits, fromSearch]);

  const fromUnit = useMemo(() => allUnits?.find(u => u.id.toString() === fromUnitId), [allUnits, fromUnitId]);
  const toUnit = useMemo(() => allUnits?.find(u => u.id.toString() === toUnitId), [allUnits, toUnitId]);

  const targetUnits = useMemo(() => {
    if (!fromUnit) return [];
    const targets = allUnits?.filter(u => u.id.toString() !== fromUnitId && u.type === fromUnit.type && u.currentOccupants < u.beds) || [];
    if (!toSearch.trim()) return targets;
    const q = toSearch.toLowerCase();
    return targets.filter(u =>
      u.code.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q)
    );
  }, [allUnits, fromUnitId, fromUnit, toSearch]);

  const { data: unitResidents, isLoading: residentsLoading } = trpc.units.getResidents.useQuery(
    { unitId: parseInt(fromUnitId) },
    { enabled: !!fromUnitId }
  );

  const utils = trpc.useUtils();

  const transferMutation = trpc.transfer.execute.useMutation({
    onSuccess: (data) => {
      toast.success(`تم نقل ${data.transferred} ساكن بنجاح`);
      setFromUnitId(""); setToUnitId(""); setResidents([]);
      setFromSearch(""); setToSearch("");
      utils.units.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Update residents list when unit changes
  const updateResidents = () => {
    if (!unitResidents) return;
    const list: ResidentSelection[] = [];
    unitResidents.egyptians?.forEach(r => {
      list.push({ id: r.id, type: "egyptian", name: r.name, identifier: r.nationalId, selected: false });
    });
    unitResidents.russians?.forEach(r => {
      list.push({ id: r.id, type: "russian", name: r.name, identifier: r.passportNumber, selected: false });
    });
    setResidents(list);
  };

  // Auto-update residents when data loads
  useMemo(() => {
    if (unitResidents) updateResidents();
  }, [unitResidents]);

  const selectedResidents = residents.filter(r => r.selected);
  const availableBeds = toUnit ? toUnit.beds - toUnit.currentOccupants : 0;

  const handleTransfer = () => {
    if (!fromUnitId || !toUnitId) { toast.error("يرجى اختيار الوحدتين"); return; }
    if (selectedResidents.length === 0) { toast.error("يرجى اختيار ساكن واحد على الأقل"); return; }
    if (selectedResidents.length > availableBeds) { toast.error("لا توجد أسرة كافية في الوحدة الهدف"); return; }

    transferMutation.mutate({
      residents: selectedResidents.map(r => ({ id: r.id, type: r.type, name: r.name })),
      fromUnitId: parseInt(fromUnitId),
      toUnitId: parseInt(toUnitId),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">نقل ساكنين</h1>
        <p className="text-muted-foreground text-sm mt-1">نقل ساكنين من وحدة سكنية إلى أخرى</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Unit */}
        <Card className="border-t-4 border-t-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-orange-500" />
              الوحدة المصدر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="ابحث بالكود أو الاسم..."
                value={fromSearch}
                onChange={(e) => setFromSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={fromUnitId} onValueChange={(v) => { setFromUnitId(v); setToUnitId(""); setToSearch(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الوحدة المصدر" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {occupiedUnits.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    لا توجد وحدات مطابقة
                  </div>
                ) : (
                  occupiedUnits.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs font-mono ${u.type === 'apartment' ? 'border-blue-300 text-blue-700' : 'border-red-300 text-red-700'}`}>
                          {u.code}
                        </Badge>
                        <span>{u.name}</span>
                        <span className="text-muted-foreground text-xs">({u.currentOccupants} ساكن)</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {fromUnit && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>النوع:</span>
                  <Badge className={fromUnit.type === "apartment" ? "bg-blue-100 text-blue-800 border-0" : "bg-red-100 text-red-800 border-0"}>
                    {fromUnit.type === "apartment" ? "شقة" : "شاليه"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>السكان:</span>
                  <span className="font-medium">{fromUnit.currentOccupants}/{fromUnit.beds}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Target Unit */}
        <Card className="border-t-4 border-t-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-green-500" />
              الوحدة الهدف
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="ابحث بالكود أو الاسم..."
                value={toSearch}
                onChange={(e) => setToSearch(e.target.value)}
                className="pr-9"
                disabled={!fromUnitId}
              />
            </div>
            <Select value={toUnitId} onValueChange={setToUnitId} disabled={!fromUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الوحدة الهدف" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {targetUnits.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    لا توجد وحدات مطابقة
                  </div>
                ) : (
                  targetUnits.map(u => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs font-mono ${u.type === 'apartment' ? 'border-blue-300 text-blue-700' : 'border-red-300 text-red-700'}`}>
                          {u.code}
                        </Badge>
                        <span>{u.name}</span>
                        <span className="text-muted-foreground text-xs">(متاح: {u.beds - u.currentOccupants})</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {toUnit && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>النوع:</span>
                  <Badge className={toUnit.type === "apartment" ? "bg-blue-100 text-blue-800 border-0" : "bg-red-100 text-red-800 border-0"}>
                    {toUnit.type === "apartment" ? "شقة" : "شاليه"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>المتاح:</span>
                  <span className={`font-medium ${availableBeds >= selectedResidents.length ? "text-green-600" : "text-red-600"}`}>
                    {availableBeds} أسرة
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transfer Arrow */}
      {fromUnitId && toUnitId && (
        <div className="flex justify-center">
          <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-full">
            <span className="text-sm font-medium">{fromUnit?.code}</span>
            <ArrowLeft className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{toUnit?.code}</span>
          </div>
        </div>
      )}

      {/* Residents Selection */}
      {fromUnitId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                اختر الساكنين للنقل
              </span>
              <Badge variant="outline">{selectedResidents.length} محدد</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {residentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : residents.length > 0 ? (
              <div className="space-y-2">
                {residents.map((r, idx) => (
                  <div
                    key={`${r.type}-${r.id}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${r.selected ? "bg-primary/5 border-primary/30" : "bg-card"}`}
                  >
                    <Checkbox
                      checked={r.selected}
                      onCheckedChange={(checked) => {
                        const updated = [...residents];
                        updated[idx].selected = !!checked;
                        setResidents(updated);
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono" dir="ltr">{r.identifier}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {r.type === "egyptian" ? "مصري" : "روسي"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>لا يوجد سكان في هذه الوحدة</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit */}
      {selectedResidents.length > 0 && toUnitId && (
        <Card>
          <CardContent className="pt-6">
            {availableBeds < selectedResidents.length && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">لا توجد أسرة كافية في الوحدة الهدف ({availableBeds} متاح، {selectedResidents.length} مطلوب)</span>
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleTransfer}
              disabled={transferMutation.isPending || availableBeds < selectedResidents.length}
            >
              {transferMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <ArrowLeftRight className="h-4 w-4 ml-2" />
              )}
              نقل {selectedResidents.length} ساكن من {fromUnit?.code} إلى {toUnit?.code}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

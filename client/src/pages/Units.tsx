import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Building2, Search, Users, BedDouble, DoorOpen, Loader2, Eye, Plus, Trash2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Units() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const userSectorId = (user as any)?.sectorId;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // New unit form state
  const [newUnit, setNewUnit] = useState({
    code: "",
    name: "",
    type: "apartment" as "apartment" | "chalet",
    floor: "",
    rooms: 1,
    beds: 2,
    ownerName: "",
    buildingName: "",
    notes: "",
  });

  const utils = trpc.useUtils();

  const { data: units, isLoading } = trpc.units.list.useQuery(
    { type: typeFilter, status: statusFilter, search: search || undefined, sectorId: userSectorId || undefined },
    { refetchInterval: 10000 }
  );

  const createMutation = trpc.units.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الوحدة بنجاح");
      utils.units.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setNewUnit({ code: "", name: "", type: "apartment", floor: "", rooms: 1, beds: 2, ownerName: "", buildingName: "", notes: "" });
    },
    onError: (err) => toast.error("فشل في الإضافة: " + err.message),
  });

  const deleteMutation = trpc.units.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الوحدة بنجاح");
      utils.units.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDeleteId(null);
    },
    onError: (err) => toast.error("فشل في الحذف: " + err.message),
  });

  const handleCreate = () => {
    if (!newUnit.code.trim() || !newUnit.name.trim()) {
      toast.error("الكود والاسم مطلوبان");
      return;
    }
    createMutation.mutate(newUnit);
  };

  const handleDelete = (e: React.MouseEvent, id: number, occupants: number) => {
    e.stopPropagation();
    if (occupants > 0) {
      toast.error("لا يمكن حذف وحدة مسكونة حالياً");
      return;
    }
    setDeleteId(id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "vacant":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-0">فارغة</Badge>;
      case "occupied":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-0">مشغولة</Badge>;
      case "maintenance":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-0">صيانة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeColor = (type: string) => {
    return type === "apartment"
      ? "border-r-4 border-r-blue-500"
      : "border-r-4 border-r-red-500";
  };

  const getTypeBadge = (type: string) => {
    return type === "apartment"
      ? <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-0">شقة</Badge>
      : <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-0">شاليه</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الوحدات السكنية</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة وعرض جميع الوحدات السكنية</p>
        </div>

        {/* Add Unit Button + Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة وحدة
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة وحدة سكنية جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>كود الوحدة *</Label>
                  <Input
                    placeholder="مثال: A-401"
                    value={newUnit.code}
                    onChange={(e) => setNewUnit(p => ({ ...p, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>اسم الوحدة *</Label>
                  <Input
                    placeholder="مثال: شقة 401"
                    value={newUnit.name}
                    onChange={(e) => setNewUnit(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>النوع</Label>
                  <Select value={newUnit.type} onValueChange={(v: "apartment" | "chalet") => setNewUnit(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">شقة</SelectItem>
                      <SelectItem value="chalet">شاليه</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الطابق</Label>
                  <Input
                    placeholder="مثال: 4"
                    value={newUnit.floor}
                    onChange={(e) => setNewUnit(p => ({ ...p, floor: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>عدد الغرف</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newUnit.rooms}
                    onChange={(e) => setNewUnit(p => ({ ...p, rooms: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>عدد الأسرة</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newUnit.beds}
                    onChange={(e) => setNewUnit(p => ({ ...p, beds: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم المالك</Label>
                    <Input
                      placeholder="اختياري"
                      value={newUnit.ownerName}
                      onChange={(e) => setNewUnit(p => ({ ...p, ownerName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>اسم العقار</Label>
                    <Input
                      placeholder="اختياري"
                      value={newUnit.buildingName}
                      onChange={(e) => setNewUnit(p => ({ ...p, buildingName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Input
                    placeholder="ملاحظات إضافية (اختياري)"
                    value={newUnit.notes}
                    onChange={(e) => setNewUnit(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button variant="outline">إلغاء</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Plus className="h-4 w-4 ml-2" />}
                إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالكود أو الاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="apartment">شقق</SelectItem>
                <SelectItem value="chalet">شاليهات</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="vacant">فارغة</SelectItem>
                <SelectItem value="occupied">مشغولة</SelectItem>
                <SelectItem value="maintenance">صيانة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      {units && (
        <p className="text-sm text-muted-foreground">
          عرض {units.length} وحدة سكنية
        </p>
      )}

      {/* Units Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : units && units.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {units.map((unit) => (
            <Card
              key={unit.id}
              className={`${getTypeColor(unit.type)} hover:shadow-lg transition-all cursor-pointer group relative`}
              onClick={() => setLocation(`/units/${unit.id}`)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-card-foreground">{unit.code}</h3>
                    <p className="text-xs text-muted-foreground">{unit.name}</p>
                    {(unit as any).buildingName && <p className="text-[10px] text-primary/70 mt-1">عقار: {(unit as any).buildingName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getTypeBadge(unit.type)}
                    {getStatusBadge(unit.status)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mt-3">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <DoorOpen className="h-4 w-4 mx-auto text-primary/70 mb-1" />
                    <p className="text-[10px] text-muted-foreground">غرف</p>
                    <p className="font-bold text-xs">{unit.rooms}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <BedDouble className="h-4 w-4 mx-auto text-primary/70 mb-1" />
                    <p className="text-[10px] text-muted-foreground">أسرة</p>
                    <p className="font-bold text-xs">{unit.beds}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <Users className="h-4 w-4 mx-auto text-primary/70 mb-1" />
                    <p className="text-[10px] text-muted-foreground">سكان</p>
                    <p className="font-bold text-xs">{unit.currentOccupants}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                    <Eye className="h-3 w-3" />
                    عرض التفاصيل
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDelete(e, unit.id, unit.currentOccupants)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-muted/30 rounded-lg border-2 border-dashed">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">لا توجد وحدات</h3>
          <p className="text-muted-foreground">لم يتم العثور على أي وحدات سكنية تطابق بحثك</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              تأكيد الحذف
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-foreground">هل أنت متأكد من رغبتك في حذف هذه الوحدة؟ لا يمكن التراجع عن هذا الإجراء.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button 
              variant="destructive" 
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Trash2 className="h-4 w-4 ml-2" />}
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

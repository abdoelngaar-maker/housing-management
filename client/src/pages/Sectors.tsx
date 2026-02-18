import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, MapPin, Users, Building2 } from "lucide-react";

const COLORS = [
  { label: "أزرق", value: "#3b82f6" },
  { label: "أحمر", value: "#ef4444" },
  { label: "أخضر", value: "#22c55e" },
  { label: "برتقالي", value: "#f97316" },
  { label: "بنفسجي", value: "#8b5cf6" },
  { label: "وردي", value: "#ec4899" },
  { label: "سماوي", value: "#06b6d4" },
  { label: "أصفر", value: "#eab308" },
];

export default function Sectors() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingSector, setEditingSector] = useState<any>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", color: "#3b82f6" });
  const [assignForm, setAssignForm] = useState({ userId: 0, sectorId: 0 });

  const utils = trpc.useUtils();
  const { data: sectors = [], isLoading } = trpc.sectors.list.useQuery();
  const { data: allUsers = [] } = trpc.sectors.users.useQuery();

  const createMutation = trpc.sectors.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء القطاع بنجاح");
      utils.sectors.list.invalidate();
      setShowCreate(false);
      setForm({ name: "", code: "", description: "", color: "#3b82f6" });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.sectors.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث القطاع بنجاح");
      utils.sectors.list.invalidate();
      setEditingSector(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.sectors.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف القطاع بنجاح");
      utils.sectors.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const assignMutation = trpc.sectors.assignUser.useMutation({
    onSuccess: () => {
      toast.success("تم تعيين الموظف للقطاع بنجاح");
      utils.sectors.users.invalidate();
      setShowAssign(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">إدارة القطاعات</h1>
          <p className="text-muted-foreground mt-1">إدارة القطاعات وتعيين الموظفين لكل قطاع</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showAssign} onOpenChange={setShowAssign}>
            <DialogTrigger asChild>
              <Button variant="outline"><Users className="ml-2 h-4 w-4" /> تعيين موظف</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>تعيين موظف لقطاع</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>الموظف</Label>
                  <Select onValueChange={(v) => setAssignForm(p => ({ ...p, userId: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {allUsers.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name || u.email || u.openId} {u.sectorId ? `(قطاع: ${sectors.find((s: any) => s.id === u.sectorId)?.name || "غير معروف"})` : "(بدون قطاع)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>القطاع</Label>
                  <Select onValueChange={(v) => setAssignForm(p => ({ ...p, sectorId: v === "none" ? 0 : Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="اختر القطاع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون قطاع (مدير عام)</SelectItem>
                      {sectors.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => assignMutation.mutate({ userId: assignForm.userId, sectorId: assignForm.sectorId || null })} disabled={!assignForm.userId || assignMutation.isPending}>
                  {assignMutation.isPending ? "جاري التعيين..." : "تعيين"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="ml-2 h-4 w-4" /> إضافة قطاع</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة قطاع جديد</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>اسم القطاع</Label>
                  <Input placeholder="مثال: الضبعة" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>كود القطاع</Label>
                  <Input placeholder="مثال: DABAA" value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value }))} />
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Input placeholder="وصف اختياري" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label>اللون</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {COLORS.map(c => (
                      <button key={c.value} onClick={() => setForm(p => ({ ...p, color: c.value }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c.value }} title={c.label} />
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.code || createMutation.isPending}>
                  {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء القطاع"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : sectors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد قطاعات</h3>
            <p className="text-muted-foreground mb-4">أضف قطاعات لتنظيم الوحدات السكنية حسب الموقع</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="ml-2 h-4 w-4" /> إضافة قطاع</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((sector: any) => {
            const sectorUsers = allUsers.filter((u: any) => u.sectorId === sector.id);
            return (
              <Card key={sector.id} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1.5" style={{ backgroundColor: sector.color || "#3b82f6" }} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color || "#3b82f6" }} />
                      {sector.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingSector(sector)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        if (confirm("هل أنت متأكد من حذف هذا القطاع؟")) deleteMutation.mutate({ id: sector.id });
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>الكود: <span className="font-mono font-bold text-foreground">{sector.code}</span></span>
                    </div>
                    {sector.description && (
                      <p className="text-muted-foreground">{sector.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{sectorUsers.length} موظف مرتبط</span>
                    </div>
                    {sectorUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sectorUsers.map((u: any) => (
                          <span key={u.id} className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                            {u.name || u.email || "مستخدم"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSector} onOpenChange={(open) => !open && setEditingSector(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل القطاع</DialogTitle></DialogHeader>
          {editingSector && (
            <div className="space-y-4 mt-4">
              <div>
                <Label>اسم القطاع</Label>
                <Input value={editingSector.name} onChange={(e) => setEditingSector((p: any) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>كود القطاع</Label>
                <Input value={editingSector.code} onChange={(e) => setEditingSector((p: any) => ({ ...p, code: e.target.value }))} />
              </div>
              <div>
                <Label>الوصف</Label>
                <Input value={editingSector.description || ""} onChange={(e) => setEditingSector((p: any) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <Label>اللون</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setEditingSector((p: any) => ({ ...p, color: c.value }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${editingSector.color === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={() => updateMutation.mutate({ id: editingSector.id, name: editingSector.name, code: editingSector.code, description: editingSector.description, color: editingSector.color })} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "جاري التحديث..." : "حفظ التعديلات"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

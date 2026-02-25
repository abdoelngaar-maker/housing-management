import { trpc } from "@/lib/trpc";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Download, Search, Loader2, Bed, Users, BedDouble } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OccupancyReport() {
  const { data: stats, isLoading, error } = trpc.units.occupancyStats.useQuery();
  const [search, setSearch] = useState("");

  if (error) {
    return <div className="p-10 text-red-500">حدث خطأ أثناء تحميل البيانات: {error.message}</div>;
  }

  const filteredStats = stats?.filter(s => 
    (s.unitCode && String(s.unitCode).toLowerCase().includes(search.toLowerCase())) ||
    (s.buildingName && String(s.buildingName).toLowerCase().includes(search.toLowerCase()))
  );

  const exportToCSV = () => {
    if (!filteredStats) return;
    
    const headers = ["الوحدة", "العقار", "إجمالي الأسرة", "الأسرة المشغولة", "الأسرة الفارغة", "الحالة"];
    const rows = filteredStats.map(s => [
      s.unitCode || "",
      s.buildingName || "",
      s.totalBeds || 0,
      s.occupiedBeds || 0,
      s.vacantBeds || 0,
      s.status === "vacant" ? "فارغة" : s.status === "occupied" ? "مشغولة" : "صيانة"
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_الإشغال_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalBeds = stats?.reduce((acc, s) => acc + (s.totalBeds || 0), 0) || 0;
  const occupiedBeds = stats?.reduce((acc, s) => acc + (s.occupiedBeds || 0), 0) || 0;
  const vacantBeds = totalBeds - occupiedBeds;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">تقرير الإشغال والأسرة</h1>
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          تصدير إكسيل
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <BedDouble className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الأسرة</p>
              <h3 className="text-2xl font-bold">{totalBeds}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-full">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الأسرة المشغولة</p>
              <h3 className="text-2xl font-bold">{occupiedBeds}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <Bed className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">الأسرة الفارغة</p>
              <h3 className="text-2xl font-bold">{vacantBeds}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالوحدة أو العقار..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right">الوحدة</TableHead>
                    <TableHead className="text-right">العقار</TableHead>
                    <TableHead className="text-right">إجمالي الأسرة</TableHead>
                    <TableHead className="text-right">المشغولة</TableHead>
                    <TableHead className="text-right">الفارغة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats?.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.unitCode}</TableCell>
                      <TableCell>{s.buildingName}</TableCell>
                      <TableCell className="font-bold">{s.totalBeds}</TableCell>
                      <TableCell className="text-orange-600">{s.occupiedBeds}</TableCell>
                      <TableCell className="text-green-600 font-bold">{s.vacantBeds}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "vacant" ? "outline" : s.status === "occupied" ? "default" : "secondary"}>
                          {s.status === "vacant" ? "فارغة" : s.status === "occupied" ? "مشغولة" : "صيانة"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

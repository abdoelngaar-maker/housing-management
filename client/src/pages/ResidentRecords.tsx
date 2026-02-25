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
import { Download, Search, Loader2 } from "lucide-react";

export default function ResidentRecords() {
  const { data: history, isLoading, error } = trpc.units.residentHistory.useQuery();
  const [search, setSearch] = useState("");

  if (error) {
    return <div className="p-10 text-red-500">حدث خطأ أثناء تحميل البيانات: {error.message}</div>;
  }

  const filteredHistory = history?.filter(r => 
    (r.name && String(r.name).toLowerCase().includes(search.toLowerCase())) ||
    (r.unitCode && String(r.unitCode).toLowerCase().includes(search.toLowerCase())) ||
    (r.idNumber && String(r.idNumber).toLowerCase().includes(search.toLowerCase()))
  );

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(Number(dateStr));
      if (isNaN(date.getTime())) return "-";
      return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return "-";
    }
  };

  const exportToCSV = () => {
    if (!filteredHistory) return;
    
    const headers = ["الوحدة", "الاسم", "الرقم القومي/الباسبور", "رقم الهاتف", "تاريخ التسكين", "تاريخ المغادرة"];
    const rows = filteredHistory.map(r => [
      r.unitCode || "",
      r.name || "",
      r.idNumber || "",
      r.phone || "",
      r.checkInDate ? new Date(Number(r.checkInDate)).toISOString().split('T')[0] : "-",
      r.checkOutDate ? new Date(Number(r.checkOutDate)).toISOString().split('T')[0] : ""
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `سجل_الساكنين_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">سجل الساكنين التفصيلي</h1>
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          تصدير إكسيل
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم، الوحدة، أو الرقم القومي..."
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
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الهوية</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">تاريخ التسكين</TableHead>
                    <TableHead className="text-right">تاريخ الرفد/المغادرة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory?.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.unitCode}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="font-mono">{r.idNumber}</TableCell>
                      <TableCell>{r.phone}</TableCell>
                      <TableCell>{formatDate(r.checkInDate)}</TableCell>
                      <TableCell className="text-red-600 font-bold">{formatDate(r.checkOutDate)}</TableCell>
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

import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Download, Search, Loader2 } from "lucide-react";

export default function ResidentRecords() {
  const { data: history, isLoading } = trpc.units.residentHistory.useQuery();
  const [search, setSearch] = useState("");

  const filteredHistory = history?.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.unitCode.toLowerCase().includes(search.toLowerCase()) ||
    r.idNumber.toLowerCase().includes(search.toLowerCase())
  );

  const exportToCSV = () => {
    if (!filteredHistory) return;
    
    const headers = ["الوحدة", "الاسم", "الرقم القومي/الباسبور", "رقم الهاتف", "تاريخ التسكين", "تاريخ المغادرة"];
    const rows = filteredHistory.map(r => [
      r.unitCode,
      r.name,
      r.idNumber,
      r.phone,
      r.checkInDate ? format(new Date(Number(r.checkInDate)), "yyyy-MM-dd") : "-",
      r.checkOutDate ? format(new Date(Number(r.checkOutDate)), "yyyy-MM-dd") : ""
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `سجل_الساكنين_${format(new Date(), "yyyy-MM-dd")}.csv`);
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
            <div className="border rounded-lg overflow-hidden">
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
                      <TableCell>
                        {r.checkInDate ? format(new Date(Number(r.checkInDate)), "dd MMMM yyyy", { locale: ar }) : "-"}
                      </TableCell>
                      <TableCell className="text-red-600 font-bold">
                        {r.checkOutDate ? format(new Date(Number(r.checkOutDate)), "dd MMMM yyyy", { locale: ar }) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredHistory?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        لا توجد بيانات مطابقة للبحث
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Building2, Users, Loader2, Brain, TrendingUp, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function Reports() {
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { da: reportData, isLoading: reportLoading } = trpc.reports.occupancy.useQuery();

  const aiInsightsMutation = trpc.reports.aiInsights.useMutation({
    onSuccess: (data) => {
      setAiInsights(data.insights);
      toast.success("تم تحليل البيانات بنجاح");
    },
    onError: (err) => toast.error("فشل في التحليل: " + err.message),
  });

  const generateInsights = () => {
    if (!stats) return;
    aiInsightsMutation.mutate({ stats });
  };

  const occupancyRate = stats && stats.totalUnits > 0
    ? Math.round((stats.occupiedUnits / stats.totalUnits) * 100) : 0;
  const aptOccupancyRate = stats && stats.totalApartments > 0
    ? Math.round((stats.occupiedApartments / stats.totalApartments) * 100) : 0;
  const chaletOccupancyRate = stats && stats.totalChalets > 0
    ? Math.round((stats.occupiedChalets / stats.totalChalets) * 100) : 0;

  const recentActions = useMemo(() => {
    if (!reportData?.records) return { checkIns: 0, checkOuts: 0, transfers: 0 };
    const now = Date.now();
    const last30Days = now - 30 * 24 * 60 * 60 * 1000;
    const recent = reportData.records.filter(r => r.actionDate > last30Days);
    return {
      checkIns: recent.filter(r => r.action === "check_in").length,
      checkOuts: recent.filter(r => r.action === "check_out").length,
      transfers: recent.filter(r => r.action === "transfer_in").length,
    };
  }, [reportData]);

  if (statsLoading || reportLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">التقارير والإحصائيات</h1>
          <p className="text-muted-foreground text-sm mt-1">تقارير تفصيلية عن حالة التسكين</p>
        </div>
      </div>

      {/* Occupancy Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-t-4 border-t-primary">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">معدل الإشغال الكلي</p>
              <div className="relative w-32 h-32 mx-auto my-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
                  <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="10" fill="none"
                    className="text-primary"
                    strokeDasharray={`${occupancyRate * 3.14} 314`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-foreground">{occupancyRate}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.occupiedUnits} من {stats?.totalUnits} وحدة
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-blue-500">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">إشغال الشقق</p>
              <div className="relative w-32 h-32 mx-auto my-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
                  <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="10" fill="none"
                    className="text-blue-500"
                    strokeDasharray={`${aptOccupancyRate * 3.14} 314`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-foreground">{aptOccupancyRate}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.occupiedApartments} من {stats?.totalApartments} شقة
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-red-500">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">إشغال الشاليهات</p>
              <div className="relative w-32 h-32 mx-auto my-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="10" fill="none" className="text-muted" />
                  <circle cx="60" cy="60" r="50" stroke="currentColor" strokeWidth="10" fill="none"
                    className="text-red-500"
                    strokeDasharray={`${chaletOccupancyRate * 3.14} 314`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-foreground">{chaletOccupancyRate}%</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.occupiedChalets} من {stats?.totalChalets} شاليه
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              إحصائيات الوحدات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">إجمالي الوحدات</span>
                <span className="font-bold text-lg">{stats?.totalUnits}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <span className="text-sm">الشقق</span>
                <span className="font-bold text-lg text-blue-600">{stats?.totalApartments}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <span className="text-sm">الشاليهات</span>
                <span className="font-bold text-lg text-red-600">{stats?.totalChalets}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <span className="text-sm">الفارغة</span>
                <span className="font-bold text-lg text-green-600">{stats?.vacantUnits}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <span className="text-sm">المشغولة</span>
                <span className="font-bold text-lg text-orange-600">{stats?.occupiedUnits}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              إحصائيات السكان
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">إجمالي السكان</span>
                <span className="font-bold text-lg">{(stats?.totalEgyptian || 0) + (stats?.totalRussian || 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇪🇬</span>
                  <span className="text-sm">المصريون</span>
                </div>
                <span className="font-bold text-lg text-blue-600">{stats?.totalEgyptian}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇷🇺</span>
                  <span className="text-sm">الروس</span>
                </div>
                <span className="font-bold text-lg text-red-600">{stats?.totalRussian}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">عمليات التسكين (30 يوم)</span>
                <span className="font-bold text-lg text-green-600">{recentActions.checkIns}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">عمليات النقل (30 يوم)</span>
                <span className="font-bold text-lg text-orange-600">{recentActions.transfers}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="border-t-4 border-t-purple-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              رؤى الذكاء الاصطناعي
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={generateInsights}
              disabled={aiInsightsMutation.isPending}
            >
              {aiInsightsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Brain className="h-4 w-4 ml-2" />
              )}
              تحليل ذكي
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiInsights ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
              <Streamdown>{aiInsights}</Streamdown>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>اضغط على "تحليل ذكي" للحصول على رؤى وتوصيات من الذكاء الاصطناعي</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

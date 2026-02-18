import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  UserPlus,
  ArrowLeftRight,
  Home as HomeIcon,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Sun, Moon } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const userSectorId = (user as any)?.sectorId;

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery(
    userSectorId ? { sectorId: userSectorId } : undefined,
    { refetchInterval: 5000 }
  );

  const { data: recentActivity, isLoading: activityLoading } = trpc.dashboard.recentActivity.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const seedMutation = trpc.units.seed.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
  });

  const occupancyRate = stats && stats.totalUnits > 0
    ? Math.round((stats.occupiedUnits / stats.totalUnits) * 100)
    : 0;

  const statCards = [
    {
      title: "إجمالي الوحدات",
      value: stats?.totalUnits ?? 0,
      icon: Building2,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      title: "الوحدات المشغولة",
      value: stats?.occupiedUnits ?? 0,
      icon: Users,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/50",
    },
    {
      title: "الوحدات الفارغة",
      value: stats?.vacantUnits ?? 0,
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/50",
    },
    {
      title: "معدل الإشغال",
      value: `${occupancyRate}%`,
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/50",
    },
  ];

  const quickActions = [
    { label: "تسكين جديد", icon: UserPlus, path: "/check-in", color: "bg-blue-600 hover:bg-blue-700 text-white" },
    { label: "تسكين جماعي", icon: Users, path: "/bulk-check-in", color: "bg-green-600 hover:bg-green-700 text-white" },
    { label: "نقل ساكنين", icon: ArrowLeftRight, path: "/transfer", color: "bg-orange-600 hover:bg-orange-700 text-white" },
    { label: "التقارير", icon: TrendingUp, path: "/reports", color: "bg-purple-600 hover:bg-purple-700 text-white" },
  ];

  const getActionLabel = (action: string) => {
    switch (action) {
      case "check_in": return "تسكين";
      case "check_out": return "إخلاء";
      case "transfer_in": return "نقل (وصول)";
      case "transfer_out": return "نقل (مغادرة)";
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "check_in": return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
      case "check_out": return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300";
      case "transfer_in": return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
      case "transfer_out": return "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (stats?.totalUnits === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">مرحباً بك في نظام إدارة التسكين</h2>
            <p className="text-muted-foreground mb-6">
              لا توجد وحدات سكنية بعد. اضغط الزر أدناه لإضافة البيانات الأولية.
            </p>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              size="lg"
              className="w-full"
            >
              {seedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Building2 className="h-4 w-4 ml-2" />
              )}
              إضافة الوحدات السكنية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-1">نظرة عامة على حالة التسكين</p>
        </div>
        <Button variant="outline" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="border shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-3xl font-bold mt-1 text-card-foreground">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Nationality Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-r-4 border-r-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">الشقق</p>
                <p className="text-xl font-bold text-card-foreground">{stats?.totalApartments ?? 0}</p>
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/50">
                مشغول: {stats?.occupiedApartments ?? 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-red-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">الشاليهات</p>
                <p className="text-xl font-bold text-card-foreground">{stats?.totalChalets ?? 0}</p>
              </div>
              <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 dark:bg-red-950/50">
                مشغول: {stats?.occupiedChalets ?? 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-blue-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">السكان المصريون</p>
                <p className="text-xl font-bold text-card-foreground">{stats?.totalEgyptian ?? 0}</p>
              </div>
              <span className="text-lg">🇪🇬</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-r-4 border-r-red-400">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">السكان الروس</p>
                <p className="text-xl font-bold text-card-foreground">{stats?.totalRussian ?? 0}</p>
              </div>
              <span className="text-lg">🇷🇺</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                className={`h-auto py-4 flex flex-col gap-2 ${action.color}`}
                onClick={() => setLocation(action.path)}
              >
                <action.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            آخر العمليات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${getActionColor(record.action)}`}>
                      {getActionLabel(record.action)}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">{record.residentName}</p>
                      <p className="text-xs text-muted-foreground">
                        الوحدة: {record.unitCode}
                        {record.fromUnitCode && ` ← ${record.fromUnitCode}`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(record.actionDate).toLocaleDateString("ar-EG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد عمليات حديثة</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

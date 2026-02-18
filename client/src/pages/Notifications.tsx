import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, BellOff, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const typeIcons: Record<string, any> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const typeColors: Record<string, string> = {
  info: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
  success: "text-green-500 bg-green-50 dark:bg-green-900/20",
  warning: "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
  error: "text-red-500 bg-red-50 dark:bg-red-900/20",
};

export default function Notifications() {
  const { user } = useAuth();
  const sectorId = (user as any)?.sectorId;
  const utils = trpc.useUtils();

  const { data: notifications = [], isLoading } = trpc.notificationsPage.list.useQuery(
    sectorId ? { sectorId } : undefined
  );

  const markReadMutation = trpc.notificationsPage.markRead.useMutation({
    onSuccess: () => {
      utils.notificationsPage.list.invalidate();
      utils.notificationsPage.unread.invalidate();
    },
  });

  const markAllReadMutation = trpc.notificationsPage.markAllRead.useMutation({
    onSuccess: () => {
      toast.success("تم تعليم جميع الإشعارات كمقروءة");
      utils.notificationsPage.list.invalidate();
      utils.notificationsPage.unread.invalidate();
    },
  });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" /> الإشعارات
          </h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : "لا توجد إشعارات جديدة"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllReadMutation.mutate(sectorId ? { sectorId } : undefined)} disabled={markAllReadMutation.isPending}>
            <CheckCheck className="ml-2 h-4 w-4" /> تعليم الكل كمقروء
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BellOff className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد إشعارات</h3>
            <p className="text-muted-foreground">ستظهر الإشعارات هنا عند إجراء عمليات التسكين والنقل</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif: any) => {
            const Icon = typeIcons[notif.type] || Info;
            const colorClass = typeColors[notif.type] || typeColors.info;
            return (
              <Card key={notif.id} className={`transition-all ${!notif.isRead ? "border-primary/30 shadow-sm" : "opacity-75"}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`font-semibold ${!notif.isRead ? "" : "text-muted-foreground"}`}>{notif.title}</h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {new Date(notif.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {!notif.isRead && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markReadMutation.mutate({ id: notif.id })}>
                              تعليم كمقروء
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

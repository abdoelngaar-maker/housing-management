import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  Building2,
  UserPlus,
  Users,
  ArrowLeftRight,
  FileUp,
  BarChart3,
  LogOut,
  PanelRight,
  Home,
  Bell,
  MapPin,
  Download,
  FileText,
  BedDouble,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { Badge } from "./ui/badge";

const menuItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/" },
  { icon: Building2, label: "الوحدات السكنية", path: "/units" },
  { icon: UserPlus, label: "تسكين فردي", path: "/check-in" },
  { icon: Users, label: "تسكين جماعي", path: "/bulk-check-in" },
  { icon: ArrowLeftRight, label: "نقل ساكنين", path: "/transfer" },
  { icon: FileUp, label: "استيراد بيانات", path: "/import" },
  { icon: Download, label: "استيراد وحدات", path: "/import-units" },
  { icon: LogOut, label: "إخلاء ساكنين", path: "/eviction" },
  { icon: FileText, label: "السجل التفصيلي", path: "/detailed-report" },
  { icon: Users, label: "سجل الساكنين", path: "/resident-records" },
  { icon: BedDouble, label: "تقرير الإشغال", path: "/occupancy-report" },
  { icon: BarChart3, label: "التقارير", path: "/reports" },
  { icon: MapPin, label: "القطاعات", path: "/sectors", adminOnly: true },
  { icon: Bell, label: "الإشعارات", path: "/notifications" },
] as const;

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full bg-card rounded-2xl shadow-xl border">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-center text-card-foreground">
              نظام إدارة التسكين الذكي
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              قم بتسجيل الدخول للوصول إلى لوحة التحكم وإدارة الوحدات السكنية
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all text-base"
          >
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();
  const isAdmin = (user as any)?.role === "admin";
  const userSectorId = (user as any)?.sectorId;

  const { data: unreadNotifs } = trpc.notificationsPage.unread.useQuery(
    userSectorId ? { sectorId: userSectorId } : undefined,
    { refetchInterval: 30000 }
  );

  const { data: userSector } = trpc.sectors.getById.useQuery(
    { id: userSectorId },
    { enabled: !!userSectorId }
  );

  const unreadCount = unreadNotifs?.length || 0;

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarEl = sidebarRef.current;
      if (!sidebarEl) return;
      const sidebarRect = sidebarEl.getBoundingClientRect();
      const newWidth = sidebarRect.right - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const filteredMenuItems = menuItems.filter((item) => {
    if ("adminOnly" in item && item.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-l-0 border-r"
          side="right"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="تبديل القائمة"
              >
                <PanelRight className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <Home className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="font-bold tracking-tight truncate text-sm">
                    إدارة التسكين
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2">
            {/* Sector Badge */}
            {!isCollapsed && userSector && (
              <div className="px-3 pb-2">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 text-xs">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: (userSector as any)?.color || "#3b82f6" }} />
                  <span className="text-muted-foreground">القطاع:</span>
                  <span className="font-semibold truncate">{(userSector as any)?.name}</span>
                </div>
              </div>
            )}

            <SidebarMenu className="px-2 py-1 gap-1">
              {filteredMenuItems.map((item) => {
                const isActive = location === item.path;
                const isNotif = item.path === "/notifications";
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-medium ${isActive ? "bg-primary/10 text-primary" : ""}`}
                    >
                      <div className="relative">
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        />
                        {isNotif && unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="flex-1">{item.label}</span>
                      {isNotif && unreadCount > 0 && !isCollapsed && (
                        <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1">
                          {unreadCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-right group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "م"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "مستخدم"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="font-semibold text-foreground">
                {activeMenuItem?.label ?? "القائمة"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

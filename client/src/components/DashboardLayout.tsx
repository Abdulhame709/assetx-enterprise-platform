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
import { startLogin } from "@/const";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/useMobile";
import { ArrowLeft, BellRing, Bolt, ClipboardCheck, Droplets, FileBarChart, Gauge, History, LayoutDashboard, Layers3, LogOut, MapPinned, Moon, ReceiptText, Settings2, Sparkles, Sun, TriangleAlert, Truck, Users, WalletCards, FileText, HelpCircle } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import GuidedTour, { openGuidedTour } from "./GuidedTour";
import { Button } from "./ui/button";
import { QuickNavigation } from "./QuickNavigation";

const menuItems = [
  { icon: Layers3, label: "بوابة الأقسام", path: "/" },
  { icon: LayoutDashboard, label: "اللوحة التنفيذية", path: "/energy" },
  { icon: FileBarChart, label: "دورات الفوترة", path: "/energy/cycles" },
  { icon: Bolt, label: "المولدات والتشغيل", path: "/energy/operations" },
  { icon: Gauge, label: "تحليل الدورة", path: "/energy/analysis" },
  { icon: ReceiptText, label: "اختبار فاتورة فعلية", path: "/energy/invoice-test" },
  { icon: Gauge, label: "التقارير", path: "/energy/reports" },
  { icon: FileText, label: "تقرير سيناريو التجربة", path: "/energy/demo-report" },
  { icon: Sparkles, label: "قرارات اليوم", path: "/energy/decisions" },
  { icon: BellRing, label: "مركز التنبيهات", path: "/energy/alerts" },
  { icon: History, label: "سجل فريق المواقع", path: "/energy/team-activity" },
  { icon: Settings2, label: "الإعدادات", path: "/energy/settings" },
  { icon: Users, label: "المستخدمون", path: "/energy/users" },
  { icon: MapPinned, label: "المواقع والفروع", path: "/energy/sites", adminOnly: true },
];

const fuelMenuItems = [
  { icon: Layers3, label: "بوابة الأقسام", path: "/" },
  { icon: Droplets, label: "الأصناف والموردون", path: "/fuel" },
  { icon: Truck, label: "توريد الوقود", path: "/fuel/receipts" },
  { icon: Droplets, label: "صرف الوقود", path: "/fuel/issues" },
  { icon: TriangleAlert, label: "الهدر والفاقد", path: "/fuel/waste" },
  { icon: ClipboardCheck, label: "الجرد والإقفال", path: "/fuel/inventory" },
  { icon: WalletCards, label: "تقارير الوقود", path: "/fuel/reports" },
  { icon: History, label: "سجل أدوار الوقود", path: "/fuel/role-audit", adminOnly: true },
];

type WorkspaceArea = "energy" | "fuel";

const workspaceMeta: Record<WorkspaceArea, { title: string; subtitle: string; icon: typeof Bolt; iconClass: string }> = {
  energy: { title: "منصة التشغيل", subtitle: "قسم الطاقة والمولدات", icon: Bolt, iconClass: "bg-teal-700" },
  fuel: { title: "منصة التشغيل", subtitle: "قسم إدارة وجرد الوقود", icon: Droplets, iconClass: "bg-amber-600" },
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
  area = "energy",
}: {
  children: React.ReactNode;
  area?: WorkspaceArea;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const { loading, user } = useAuth();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
      const parsed = saved ? Number.parseInt(saved, 10) : NaN;
      if (Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        setSidebarWidth(parsed);
      }
    } catch {
      // بعض بيئات المعاينة والمستندات المقيدة تمنع التخزين المحلي؛ القيمة الافتراضية كافية.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
    } catch {
      // لا تمنع فشل عملية الحفظ عرض لوحة التحكم.
    }
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) return <ProtectedRouteLogin area={area} />;

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent area={area} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function ProtectedRouteLogin({ area }: { area: WorkspaceArea }) {
  const isFuel = area === "fuel";
  const accent = isFuel ? "#d97706" : "#0f887f";
  const softAccent = isFuel ? "#fff7e6" : "#ecfdf5";
  const areaLabel = isFuel ? "إدارة وجرد الوقود" : "الطاقة والمولدات";
  const AreaIcon = isFuel ? Droplets : Bolt;

  return (
    <main dir="rtl" data-testid="protected-route-login" className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_8%,rgba(251,191,36,.13),transparent_28%),radial-gradient(circle_at_88%_6%,rgba(13,148,136,.14),transparent_30%),linear-gradient(135deg,#f8fafc,#f0fdfa)] p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between border-b border-slate-200/80 pb-5">
          <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,.18)]"><Layers3 className="h-5 w-5" /></div><div><p className="text-sm font-black text-slate-950">منصة التشغيل الموحدة</p><p className="text-xs text-slate-500">الطاقة والوقود ضمن تجربة واحدة</p></div></div>
          <span className="hidden rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 sm:block">وصول آمن ومخصص</span>
        </header>
        <section className="my-auto grid items-center gap-10 py-12 lg:grid-cols-[1.08fr_.92fr] lg:py-18">
          <div className="order-2 rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_22px_60px_rgba(15,23,42,.1)] backdrop-blur-sm sm:p-9 lg:order-1">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: softAccent, color: accent }}><AreaIcon className="h-4 w-4" />قسم {areaLabel}</div>
            <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">سجّل الدخول لمتابعة العمل من حيث وصلت.</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">هذا الرابط يقود إلى مساحة محمية. بعد تسجيل الدخول ستظهر لك الصفحات والعمليات المتاحة بحسب دورك وصلاحياتك، مع الحفاظ على استقلال بيانات الطاقة والوقود.</p>
            <Button onClick={startLogin} size="lg" className="mt-8 h-12 w-full gap-2 rounded-xl text-base shadow-lg transition-transform active:scale-[.98] sm:w-auto sm:px-7" style={{ backgroundColor: accent }}>تسجيل الدخول <ArrowLeft className="h-4 w-4" /></Button>
          </div>
          <div className="order-1 space-y-4 lg:order-2">
            <div className="rounded-[2rem] border border-white/80 bg-slate-950 p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,.22)] sm:p-9"><div className="flex items-center justify-between"><span className="text-sm font-bold text-white/90">مساحة محمية</span><span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ backgroundColor: softAccent, color: accent }}><AreaIcon className="h-5 w-5" /></span></div><p className="mt-8 text-2xl font-black leading-snug">كل صفحة تبقى ضمن إطار واحد متسق، حتى عند فتح الرابط مباشرة.</p><div className="mt-7 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full w-2/3 rounded-full" style={{ backgroundColor: accent }} /></div></div>
            <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/75 p-5 text-sm leading-6 text-slate-600 shadow-sm">إن لم يكن لديك حق الوصول للقسم، لن تظهر بياناته أو عملياته بعد تسجيل الدخول.</div>
          </div>
        </section>
      </div>
    </main>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  area: WorkspaceArea;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  area,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const currentMenuItems = (area === "fuel" ? fuelMenuItems : menuItems).filter(item => !("adminOnly" in item && item.adminOnly) || user?.role === "admin");
  const activeMenuItem = currentMenuItems.find(item => item.path === location);
  const currentWorkspace = workspaceMeta[area];
  const WorkspaceIcon = currentWorkspace.icon;
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const themeToggle = <Button data-tour="theme-toggle" type="button" size="icon" variant="outline" className="h-9 w-9 rounded-xl border-border bg-card text-foreground shadow-sm transition-transform active:scale-95" onClick={toggleTheme} aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"} title={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}>{theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}</Button>;

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
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

  const helpButton = <Button data-tour="workspace-help" type="button" size="icon" variant="outline" className="h-9 w-9 rounded-xl border-border bg-card text-foreground shadow-sm transition-transform active:scale-95" onClick={openGuidedTour} aria-label="إعادة الجولة الإرشادية" title="إعادة الجولة الإرشادية"><HelpCircle className="h-4 w-4 text-teal-700" /></Button>;

  return (
    <>
      <GuidedTour storageKey={`guided-tour-${area}-v1`} steps={[{ target: "[data-tour='workspace-nav']", title: "هذه هي قائمة العمل", description: "تجد هنا صفحات القسم الحالي فقط. انتقل بين الدورات والتشغيل والتحليل أو بين التوريد والصرف والجرد بحسب مساحة العمل." }, { target: "[data-tour='workspace-quick-nav']", title: "ابحث عن أي صفحة بسرعة", description: "استخدم البحث السريع أو الاختصار Ctrl+K للوصول إلى صفحة أو عملية دون تصفح القائمة." }, { target: "[data-tour='theme-toggle']", title: "اختر المظهر المناسب", description: "بدّل بين الوضع الفاتح والداكن، وسيبقى اختيارك محفوظًا على جهازك عندما تسمح البيئة بذلك." }, { target: "[data-tour='workspace-help']", title: "يمكنك إعادة الجولة متى شئت", description: "اضغط زر المساعدة هذا لإعادة الجولة الإرشادية. راجع دليل التطبيق لمعرفة تفاصيل الإدخال والاعتماد والتقارير." }]} />
      <div className="app-shell relative" ref={sidebarRef}>
        <Sidebar data-tour="workspace-nav"
          collapsible={isMobile ? "offcanvas" : "none"}
          className="border-l-0 bg-sidebar"
          side="right"
          disableTransition={isResizing}
          style={{ borderColor: "var(--workspace-border)", backgroundColor: "var(--sidebar)" }}
        >
          <SidebarHeader className="h-16 justify-center border-b bg-sidebar" style={{ borderColor: "var(--workspace-border)" }}>
            <div className="flex items-center gap-3 px-4 w-full">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white ${currentWorkspace.iconClass}`}><WorkspaceIcon className="h-4 w-4" /></div>
              <div className="flex min-w-0 flex-col"><span className="font-bold tracking-tight">{currentWorkspace.title}</span><span className="text-[11px] text-muted-foreground">{currentWorkspace.subtitle}</span></div>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {currentMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 rounded-xl font-normal transition-all"
                      style={isActive ? { backgroundColor: "var(--workspace-active-bg)", color: "var(--workspace-active-fg)", fontWeight: 700 } : { color: "var(--workspace-muted)" }}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
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

      <SidebarInset className="bg-background" style={{ backgroundColor: "var(--workspace-surface)" }}>
        <div className="hidden h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur md:flex" style={{ borderColor: "var(--workspace-border)", backgroundColor: "var(--workspace-header)" }}>
          <div><p className="text-sm font-semibold text-foreground">{activeMenuItem?.label ?? currentWorkspace.subtitle}</p><p className="text-xs text-muted-foreground">{currentWorkspace.subtitle}</p></div>
          <div className="flex items-center gap-2">{helpButton}{themeToggle}<QuickNavigation userRole={user?.role} /></div>
        </div>
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur" style={{ borderColor: "var(--workspace-border)", backgroundColor: "var(--workspace-header)" }}>
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "القائمة"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">{helpButton}{themeToggle}<QuickNavigation userRole={user?.role} compact /></div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-5">{children}</main>
      </SidebarInset>
    </>
  );
}

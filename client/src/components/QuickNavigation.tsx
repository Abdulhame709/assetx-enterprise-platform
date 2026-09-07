import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { BarChart3, Bolt, ClipboardCheck, Droplets, FileBarChart, FileText, Gauge, History, Layers3, ReceiptText, Search, Settings2, TriangleAlert, Truck, Users, WalletCards, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type QuickNavigationProps = {
  userRole?: string;
  compact?: boolean;
};

const baseItems = [
  { group: "عام", label: "بوابة الأقسام", hint: "اختيار الطاقة أو الوقود", path: "/", icon: Layers3 },
  { group: "الطاقة والمولدات", label: "اللوحة التنفيذية", hint: "مؤشرات تكلفة الطاقة", path: "/energy", icon: BarChart3 },
  { group: "الطاقة والمولدات", label: "دورات الفوترة", hint: "الفواتير والقراءات", path: "/energy/cycles", icon: FileBarChart },
  { group: "الطاقة والمولدات", label: "المولدات والتشغيل", hint: "المولدات والوقود والصيانة", path: "/energy/operations", icon: Bolt },
  { group: "الطاقة والمولدات", label: "تحليل الدورة", hint: "مقارنة تكاليف الطاقة", path: "/energy/analysis", icon: Gauge },
  { group: "الطاقة والمولدات", label: "اختبار فاتورة فعلية", hint: "معاينة شريحة التعرفة", path: "/energy/invoice-test", icon: ReceiptText },
  { group: "الطاقة والمولدات", label: "تقارير الطاقة", hint: "تصدير Excel وPDF", path: "/energy/reports", icon: BarChart3 },
  { group: "الطاقة والمولدات", label: "تقرير سيناريو التجربة", hint: "مشاركة بيانات الاختبار", path: "/energy/demo-report", icon: FileText },
  { group: "الطاقة والمولدات", label: "إعدادات الطاقة", hint: "التعرفة والخيارات", path: "/energy/settings", icon: Settings2 },
  { group: "الطاقة والمولدات", label: "المستخدمون والصلاحيات", hint: "إدارة أدوار الموظفين", path: "/energy/users", icon: Users },
  { group: "إدارة الوقود", label: "أصناف وموردو الوقود", hint: "الخزانات والأرصدة", path: "/fuel", icon: Droplets },
  { group: "إدارة الوقود", label: "توريد الوقود", hint: "استلام وتوثيق التوريد", path: "/fuel/receipts", icon: Truck },
  { group: "إدارة الوقود", label: "صرف الوقود", hint: "تسجيل الصرف بالعداد", path: "/fuel/issues", icon: Droplets },
  { group: "إدارة الوقود", label: "الهدر والفاقد", hint: "تسجيل الهدر الموثق", path: "/fuel/waste", icon: TriangleAlert },
  { group: "إدارة الوقود", label: "جرد الوقود", hint: "الاعتماد والإقفال", path: "/fuel/inventory", icon: ClipboardCheck },
  { group: "إدارة الوقود", label: "تقارير الوقود", hint: "أرصدة وحركات الوقود", path: "/fuel/reports", icon: WalletCards },
];

const auditItem = { group: "إدارة الوقود", label: "سجل أدوار الوقود", hint: "تتبع منح الصلاحيات", path: "/fuel/role-audit", icon: History };

export function getQuickNavigationItems(userRole?: string) {
  return userRole === "admin" ? [...baseItems, auditItem] : baseItems;
}

export function QuickNavigation({ userRole, compact = false }: QuickNavigationProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const items = useMemo(() => getQuickNavigationItems(userRole), [userRole]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(current => !current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  return <>
    <Button variant="outline" size={compact ? "icon" : "sm"} className={compact ? "h-9 w-9" : "gap-2 bg-background"} onClick={() => setOpen(true)} data-tour="workspace-quick-nav" aria-label="بحث سريع للتنقل" aria-keyshortcuts="Control+K Meta+K">
      <Search className="h-4 w-4" />
      {!compact && <><span>بحث سريع</span><CommandShortcut>Ctrl K</CommandShortcut></>}
    </Button>
    <CommandDialog open={open} onOpenChange={setOpen} title="بحث سريع" description="انتقل إلى صفحة داخل المنصة">
      <CommandInput placeholder="ابحث عن صفحة أو عملية…" />
      <CommandList dir="rtl">
        <CommandEmpty>لا توجد صفحة مطابقة.</CommandEmpty>
        {["عام", "الطاقة والمولدات", "إدارة الوقود"].map(group => {
          const groupItems = items.filter(item => item.group === group);
          return groupItems.length ? <CommandGroup key={group} heading={group}>{groupItems.map(item => {
            const Icon = item.icon;
            return <CommandItem key={item.path} value={`${item.label} ${item.hint}`} onSelect={() => navigate(item.path)}><Icon className="h-4 w-4" /><div className="min-w-0"><p>{item.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p></div></CommandItem>;
          })}</CommandGroup> : null;
        })}
      </CommandList>
    </CommandDialog>
  </>;
}

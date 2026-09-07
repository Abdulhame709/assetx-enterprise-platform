import { useAuth } from "@/_core/hooks/useAuth";
import { PlatformLoading } from "@/components/WorkspaceLoading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { startLogin } from "@/const";
import { ArrowLeft, BarChart3, Droplets, Layers3, LogOut, ShieldCheck, Zap } from "lucide-react";
import GuidedTour from "@/components/GuidedTour";
import { useLocation } from "wouter";

const modules = [
  {
    key: "energy",
    title: "الطاقة والمولدات",
    description: "دورات الفوترة، قراءات المؤسسة، تشغيل المولدات، المقارنة والتوصية التشغيلية.",
    route: "/energy",
    icon: Zap,
    accent: "from-teal-700 via-teal-700 to-cyan-700",
    soft: "bg-teal-50 text-teal-900",
    items: ["تكلفة kWh", "الفواتير والتحليل", "تشغيل المولدات"],
  },
  {
    key: "fuel",
    title: "إدارة وجرد الوقود",
    description: "الأصناف والخزانات، التوريد والصرف، الهدر، الجرد وتقارير الرصيد.",
    route: "/fuel",
    icon: Droplets,
    accent: "from-amber-500 via-orange-600 to-rose-600",
    soft: "bg-amber-50 text-amber-950",
    items: ["التوريد والصرف", "رصيد الخزانات", "الجرد والفروقات"],
  },
];

export default function SectionPortalPage() {
  const { loading, user, logout } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) return <PlatformLoading />;

  if (!user) {
    return <main dir="rtl" className="relative grid min-h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_85%_7%,rgba(13,148,136,.20),transparent_26%),radial-gradient(circle_at_12%_92%,rgba(249,115,22,.16),transparent_28%),linear-gradient(135deg,#f8fafc_0%,#f0fdfa_48%,#fff7ed_100%)] p-5 text-slate-950"><div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full border border-teal-200/70 bg-white/35" /><div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full border border-orange-200/70 bg-white/35" /><div className="relative w-full max-w-md"><div className="mb-5 flex items-center justify-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15"><Layers3 className="h-5 w-5" /></div><div className="text-right"><p className="text-sm font-black">منصة التشغيل الموحدة</p><p className="text-xs text-slate-500">الطاقة والوقود ضمن تجربة واحدة</p></div></div><Card className="overflow-hidden border border-white/80 bg-white/90 shadow-2xl shadow-slate-900/10 backdrop-blur"><div className="h-2 bg-gradient-to-l from-teal-700 via-teal-600 to-amber-500" /><CardContent className="space-y-6 p-7 text-center sm:p-9"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-teal-50 text-teal-700"><ShieldCheck className="h-8 w-8" /></div><div><p className="text-xs font-bold text-teal-700">وصول آمن ومخصص</p><h1 className="mt-2 text-3xl font-black tracking-tight">ابدأ من مساحة عملك</h1><p className="mt-3 text-sm leading-7 text-slate-600">سجّل الدخول للوصول إلى قسم الطاقة أو إدارة وجرد الوقود بحسب الدور والصلاحية الممنوحة لك.</p></div><Button onClick={() => startLogin()} className="w-full bg-gradient-to-l from-teal-700 via-teal-600 to-cyan-700 text-white shadow-lg shadow-teal-700/20 hover:brightness-105">تسجيل الدخول<ArrowLeft className="mr-2 h-4 w-4" /></Button><div className="grid grid-cols-2 gap-3 text-right"><div className="rounded-2xl bg-teal-50 p-3"><Zap className="h-4 w-4 text-teal-700" /><p className="mt-2 text-xs font-bold text-teal-900">الطاقة والمولدات</p></div><div className="rounded-2xl bg-amber-50 p-3"><Droplets className="h-4 w-4 text-amber-700" /><p className="mt-2 text-xs font-bold text-amber-950">إدارة وجرد الوقود</p></div></div></CardContent></Card></div></main>;
  }

  return <main dir="rtl" className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_83%_3%,rgba(13,148,136,.16),transparent_24%),linear-gradient(135deg,#f8fafc_0%,#f3f7f7_44%,#fff7ed_100%)] text-slate-950">
    <GuidedTour storageKey="guided-tour-portal-v1" steps={[{ target: "[data-tour='portal-header']", title: "مرحبًا بك في المنصة الموحدة", description: "من هنا تبدأ رحلتك. يجمع النظام قسم الطاقة والمولدات وقسم إدارة وجرد الوقود، مع بقاء البيانات والصلاحيات منفصلة." }, { target: "[data-tour='energy-module']", title: "قسم الطاقة والمولدات", description: "استخدم هذا القسم لدورات الفوترة والعدادات والمولدات والمقارنة بين تكلفة المؤسسة وتكلفة المولدات." }, { target: "[data-tour='fuel-module']", title: "قسم إدارة وجرد الوقود", description: "هنا تسجل الأصناف والتوريد والصرف والهدر والجرد والإقفال، مع متابعة أرصدة المواقع." }, { target: "[data-tour='portal-auth']", title: "وصول آمن حسب الصلاحية", description: "بعد الدخول تظهر لك الصفحات والمواقع الممنوحة فقط. يمكنك تخطي الجولة أو تشغيلها مجددًا من زر المساعدة داخل لوحة التحكم." }]} />
    <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8 sm:py-6 lg:px-10">
      <header data-tour="portal-header" className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-5"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15"><Layers3 className="h-5 w-5" /></div><div><p className="text-sm font-bold">منصة التشغيل الموحدة</p><p className="text-xs text-slate-500">الطاقة والوقود ضمن تجربة دخول واحدة</p></div></div><div className="flex items-center gap-3"><div className="hidden text-left sm:block"><p className="text-sm font-bold">{user.name || "مستخدم النظام"}</p><p className="text-xs text-slate-500">جلسة مصادقة آمنة</p></div><Button variant="outline" size="icon" title="تسجيل الخروج" onClick={logout}><LogOut className="h-4 w-4" /></Button></div></header>
      <section className="grid gap-6 py-8 sm:gap-8 sm:py-12 lg:grid-cols-[1.05fr_.95fr] lg:items-end"><div className="max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm"><ShieldCheck className="h-3.5 w-3.5 text-teal-700" />اختيار القسم وفق الصلاحيات</div><h1 className="text-4xl font-black leading-[1.12] tracking-tight sm:text-5xl">اختر مساحة العمل<br /><span className="text-teal-700">التي تريد إدارتها اليوم.</span></h1><p className="mt-4 max-w-xl text-base leading-8 text-slate-600">تنتقل بين القسمين من هنا، بينما تبقى كل السجلات والحسابات والصلاحيات ضمن نطاقها المتخصص والقابل للتدقيق.</p></div><div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-6"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><BarChart3 className="h-6 w-6" /></div><div><p className="font-bold">وصول موحّد، بيانات مستقلة</p><p className="mt-1 text-sm leading-6 text-slate-500">لا تُخلط حركة الخزان مع تحليلات تكلفة الطاقة، حتى عند استخدام الحساب نفسه.</p></div></div></div></section>
      <section className="grid gap-6 pb-8 sm:pb-12 lg:grid-cols-2">{modules.map(module => { const Icon = module.icon; return <Card data-tour={`${module.key}-module`} key={module.key} className="group overflow-hidden border-0 bg-white shadow-xl shadow-slate-900/5 transition-transform duration-200 hover:-translate-y-1"><div className={`h-2 bg-gradient-to-l ${module.accent}`} /><CardContent className="p-5 sm:p-8"><div className="flex items-start justify-between gap-5"><div className={`grid h-14 w-14 place-items-center rounded-2xl ${module.soft}`}><Icon className="h-7 w-7" /></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">قسم مستقل</span></div><h2 className="mt-6 text-2xl font-black sm:mt-8">{module.title}</h2><p className="mt-3 min-h-14 text-sm leading-7 text-slate-600">{module.description}</p><div className="mt-6 flex flex-wrap gap-2">{module.items.map(item => <span key={item} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">{item}</span>)}</div><Button data-tour={module.key === "energy" ? "portal-auth" : undefined} onClick={() => setLocation(module.route)} className={`mt-7 w-full bg-gradient-to-l ${module.accent} text-white shadow-md hover:brightness-105 sm:mt-8`}>دخول القسم<ArrowLeft className="mr-2 h-4 w-4" /></Button></CardContent></Card>})}</section>
    </div>
  </main>;
}

import { Layers3 } from "lucide-react";
import { Skeleton } from "./ui/skeleton";

export function PlatformLoading() {
  return (
    <div dir="rtl" className="loading-surface min-h-screen bg-[radial-gradient(circle_at_82%_8%,rgba(13,148,136,0.12),transparent_28%),linear-gradient(135deg,#f8fafc,#f0fdfa)] p-4 sm:p-8" data-testid="platform-loading" role="status" aria-label="جارٍ تجهيز مساحة العمل">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between border-b border-slate-200/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-sm"><Layers3 className="h-5 w-5" /></div>
            <div><p className="text-sm font-black text-slate-950">منصة التشغيل الموحدة</p><p className="text-xs text-slate-500">جارٍ تجهيز مساحة العمل</p></div>
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </header>
        <WorkspacePageLoading label="تهيئة الواجهة" />
      </div>
    </div>
  );
}

export function WorkspacePageLoading({ label = "جارٍ تحميل الصفحة" }: { label?: string }) {
  return (
    <div dir="rtl" className="loading-surface mx-auto max-w-7xl space-y-6 py-6" aria-live="polite" aria-label={label}>
      <div className="space-y-3 border-b border-slate-200 pb-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_.85fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

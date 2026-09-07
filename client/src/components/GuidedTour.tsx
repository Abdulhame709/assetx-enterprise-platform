import { ArrowLeft, ArrowRight, Check, HelpCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type GuidedTourStep = {
  target?: string;
  title: string;
  description: string;
};

type GuidedTourProps = {
  storageKey: string;
  steps: GuidedTourStep[];
  autoStart?: boolean;
};

const OPEN_EVENT = "open-guided-tour";

function readCompleted(key: string) {
  try {
    return window.localStorage.getItem(key) === "done";
  } catch {
    return false;
  }
}

function markCompleted(key: string) {
  try {
    window.localStorage.setItem(key, "done");
  } catch {
    // التخزين المحلي اختياري؛ الجولة تعمل حتى في البيئات المقيدة.
  }
}

export function openGuidedTour() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function clampTourStep(index: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

export function guidedTourStorageKey(area: "portal" | "energy" | "fuel") {
  return `guided-tour-${area}-v1`;
}

export default function GuidedTour({ storageKey, steps, autoStart = true }: GuidedTourProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(() => clampTourStep(0, steps.length));
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];

  const updateTarget = useMemo(() => () => {
    if (!open || !step?.target) {
      setTargetRect(null);
      return;
    }
    const target = document.querySelector(step.target);
    if (!target) {
      setTargetRect(null);
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    setTargetRect(target.getBoundingClientRect());
  }, [open, step]);

  useEffect(() => {
    if (autoStart && !readCompleted(storageKey)) {
      const timer = window.setTimeout(() => setOpen(true), 450);
      return () => window.clearTimeout(timer);
    }
  }, [autoStart, storageKey]);

  useEffect(() => {
    const handleOpen = () => {
      setStepIndex(clampTourStep(0, steps.length));
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updateTarget);
    const handleViewportChange = () => updateTarget();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, stepIndex, updateTarget]);

  if (!open || !step) return null;

  const finish = () => {
    markCompleted(storageKey);
    setOpen(false);
  };
  const next = () => {
    if (stepIndex >= steps.length - 1) finish();
    else setStepIndex(current => clampTourStep(current + 1, steps.length));
  };
  const panelTop = targetRect ? Math.min(Math.max(targetRect.bottom + 16, 18), window.innerHeight - 270) : Math.max(window.innerHeight / 2 - 135, 18);
  const panelRight = targetRect ? Math.min(Math.max(window.innerWidth - targetRect.right, 18), window.innerWidth - 318) : 18;

  return <div dir="rtl" className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="guided-tour-title">
    <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={finish} aria-hidden="true" />
    {targetRect && <div className="pointer-events-none fixed rounded-2xl ring-4 ring-teal-400 ring-offset-4 ring-offset-transparent transition-all duration-200" style={{ top: Math.max(targetRect.top - 8, 4), left: Math.max(targetRect.left - 8, 4), width: targetRect.width + 16, height: targetRect.height + 16 }} />}
    <section className="absolute w-[min(320px,calc(100vw-32px))] rounded-3xl border border-white/70 bg-card p-5 text-card-foreground shadow-2xl shadow-slate-950/30" style={{ top: panelTop, right: panelRight }}>
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"><HelpCircle className="h-5 w-5" /></div>
        <button type="button" onClick={finish} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="تخطي الجولة"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">دليل البدء السريع · {stepIndex + 1} من {steps.length}</p>
      <h2 id="guided-tour-title" className="mt-2 text-lg font-black leading-7">{step.title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={finish} className="text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">تخطي الجولة</button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && <button type="button" onClick={() => setStepIndex(current => clampTourStep(current - 1, steps.length))} className="inline-flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-xs font-bold transition-colors hover:bg-accent"><ArrowRight className="h-3.5 w-3.5" />السابق</button>}
          <button type="button" onClick={next} className="inline-flex h-9 items-center gap-1 rounded-xl bg-teal-700 px-3 text-xs font-bold text-white transition-transform hover:bg-teal-800 active:scale-95">{stepIndex >= steps.length - 1 ? <><Check className="h-3.5 w-3.5" />إنهاء</> : <>التالي<ArrowLeft className="h-3.5 w-3.5" /></>}</button>
        </div>
      </div>
    </section>
  </div>;
}

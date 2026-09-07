export const permissionSections = ["energy", "fuel", "platform"] as const;
export type PermissionSection = (typeof permissionSections)[number];

export const permissionActions = ["view", "create", "update", "delete", "assign", "approve", "print", "export"] as const;
export type PermissionAction = (typeof permissionActions)[number];

export const permissionActionLabels: Record<PermissionAction, string> = {
  view: "عرض",
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  assign: "تعيين",
  approve: "اعتماد",
  print: "طباعة",
  export: "تصدير",
};

export const permissionCatalog = [
  { section: "energy", resource: "dashboard", label: "لوحة الطاقة", actions: ["view", "print", "export"] },
  { section: "energy", resource: "cycles", label: "دورات الفوترة", actions: ["view", "create", "update", "delete", "approve", "print", "export"] },
  { section: "energy", resource: "meters", label: "قراءات العدادات", actions: ["view", "create", "update", "delete", "print", "export"] },
  { section: "energy", resource: "invoices", label: "فواتير المؤسسة", actions: ["view", "create", "update", "delete", "approve", "print", "export"] },
  { section: "energy", resource: "generators", label: "المولدات والتشغيل", actions: ["view", "create", "update", "delete", "print", "export"] },
  { section: "energy", resource: "maintenance", label: "الصيانة والإهلاك", actions: ["view", "create", "update", "delete", "print", "export"] },
  { section: "energy", resource: "alerts", label: "التنبيهات", actions: ["view", "update", "assign", "print", "export"] },
  { section: "energy", resource: "reports", label: "التقارير والقرارات", actions: ["view", "print", "export"] },
  { section: "fuel", resource: "inventory", label: "المخزون والجرد", actions: ["view", "create", "update", "delete", "approve", "print", "export"] },
  { section: "fuel", resource: "transactions", label: "التوريد والصرف والهدر", actions: ["view", "create", "update", "delete", "print", "export"] },
  { section: "fuel", resource: "reports", label: "تقارير الوقود", actions: ["view", "print", "export"] },
  { section: "platform", resource: "settings", label: "إعدادات المنصة والتعرفة", actions: ["view", "update", "approve", "print", "export"] },
  { section: "platform", resource: "users", label: "المستخدمون والصلاحيات", actions: ["view", "create", "update", "delete", "print", "export"] },
] as const;

export type PermissionResource = (typeof permissionCatalog)[number]["resource"];
export type PermissionCatalogItem = (typeof permissionCatalog)[number];

export function permissionKey(section: string, resource: string, action: string) {
  return `${section}:${resource}:${action}`;
}

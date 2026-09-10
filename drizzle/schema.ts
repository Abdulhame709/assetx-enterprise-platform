import {
  bigint,
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoles = [
  "user",
  "admin",
  "energy_operator",
  "accountant",
  "maintenance",
  "reviewer",
  "auditor",
  "management",
] as const;

export type EnergyRole = (typeof userRoles)[number];

export const siteSections = ["energy", "fuel"] as const;
export const siteAccessLevels = ["viewer", "operator", "supervisor"] as const;
export const alertResolutionStatuses = ["acknowledged", "resolved"] as const;
export const alertActionTypes = ["acknowledged", "resolved", "reopened", "assigned"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", userRoles).default("management").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const sites = mysqlTable(
  "sites",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    city: varchar("city", { length: 120 }),
    address: text("address"),
    isActive: boolean("isActive").default(true).notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("site_code_unique").on(table.code), index("site_active_idx").on(table.isActive)],
);

export const siteRoleGrants = mysqlTable(
  "siteRoleGrants",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    siteId: int("siteId").notNull(),
    section: mysqlEnum("section", siteSections).notNull(),
    accessLevel: mysqlEnum("accessLevel", siteAccessLevels).notNull(),
    grantedBy: int("grantedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("site_role_grant_unique").on(table.userId, table.siteId, table.section),
    index("site_role_grant_user_idx").on(table.userId, table.section),
    index("site_role_grant_site_idx").on(table.siteId, table.section),
  ],
);

export const userInvitationStatuses = ["pending", "accepted", "cancelled"] as const;

export const userInvitations = mysqlTable(
  "userInvitations",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    role: mysqlEnum("role", userRoles).default("user").notNull(),
    status: mysqlEnum("status", userInvitationStatuses).default("pending").notNull(),
    invitedBy: int("invitedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("user_invitation_email_idx").on(table.email, table.status), index("user_invitation_status_idx").on(table.status, table.createdAt)],
);

export const alertResolutions = mysqlTable(
  "alertResolutions",
  {
    id: int("id").autoincrement().primaryKey(),
    alertKey: varchar("alertKey", { length: 191 }).notNull(),
    userId: int("userId").notNull(),
    siteId: int("siteId"),
    status: mysqlEnum("status", alertResolutionStatuses).notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("alert_resolution_user_key_unique").on(table.alertKey, table.userId),
    index("alert_resolution_site_idx").on(table.siteId, table.updatedAt),
  ],
);

export const alertActionHistory = mysqlTable(
  "alertActionHistory",
  {
    id: int("id").autoincrement().primaryKey(),
    alertKey: varchar("alertKey", { length: 191 }).notNull(),
    userId: int("userId").notNull(),
    siteId: int("siteId"),
    action: mysqlEnum("action", alertActionTypes).notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("alert_action_history_user_key_idx").on(table.userId, table.alertKey, table.createdAt),
    index("alert_action_history_site_idx").on(table.siteId, table.createdAt),
  ],
);

export const alertAssignments = mysqlTable(
  "alertAssignments",
  {
    id: int("id").autoincrement().primaryKey(),
    alertKey: varchar("alertKey", { length: 191 }).notNull(),
    siteId: int("siteId"),
    assignedToUserId: int("assignedToUserId").notNull(),
    assignedByUserId: int("assignedByUserId").notNull(),
    dueAt: timestamp("dueAt").notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("alert_assignment_key_unique").on(table.alertKey),
    index("alert_assignment_assignee_due_idx").on(table.assignedToUserId, table.dueAt),
    index("alert_assignment_site_due_idx").on(table.siteId, table.dueAt),
  ],
);

export const billingCycleStatuses = ["draft", "data_entry", "validation", "reviewed", "approved", "closed"] as const;
export const cycleCostModels = ["cash", "full"] as const;
export const measurementModes = ["kwh", "kw", "kva"] as const;
export const recordSourceTypes = ["manual", "meter", "invoice", "imported"] as const;

export const tariffVersions = mysqlTable("tariffVersions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  pricingMode: mysqlEnum("pricingMode", ["whole_cycle_rate", "progressive"])
    .default("whole_cycle_rate")
    .notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  effectiveTo: timestamp("effectiveTo"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tariffBrackets = mysqlTable(
  "tariffBrackets",
  {
    id: int("id").autoincrement().primaryKey(),
    tariffVersionId: int("tariffVersionId").notNull(),
    sequence: int("sequence").notNull(),
    minKwh: decimal("minKwh", { precision: 14, scale: 3 }).notNull(),
    maxKwh: decimal("maxKwh", { precision: 14, scale: 3 }),
    unitRate: decimal("unitRate", { precision: 16, scale: 4 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("tariff_bracket_version_idx").on(table.tariffVersionId),
    uniqueIndex("tariff_bracket_sequence_unique").on(table.tariffVersionId, table.sequence),
  ],
);

export const utilityMeters = mysqlTable(
  "utilityMeters",
  {
    id: int("id").autoincrement().primaryKey(),
    siteId: int("siteId"),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    multiplier: decimal("multiplier", { precision: 12, scale: 4 }).default("1").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("utility_meter_code_unique").on(table.code), index("utility_meter_site_idx").on(table.siteId)],
);

export const billingCycles = mysqlTable(
  "billingCycles",
  {
    id: int("id").autoincrement().primaryKey(),
    siteId: int("siteId"),
    title: varchar("title", { length: 160 }).notNull(),
    periodStart: timestamp("periodStart").notNull(),
    periodEnd: timestamp("periodEnd").notNull(),
    status: mysqlEnum("status", billingCycleStatuses).default("draft").notNull(),
    tariffVersionId: int("tariffVersionId"),
    selectedCostModel: mysqlEnum("selectedCostModel", cycleCostModels).default("cash").notNull(),
    depreciationMode: mysqlEnum("depreciationMode", ["accounting", "operational"])
      .default("accounting")
      .notNull(),
    maintenanceMode: mysqlEnum("maintenanceMode", ["actual", "allocated"])
      .default("actual")
      .notNull(),
    calculationVersion: varchar("calculationVersion", { length: 32 }).default("1.0.0").notNull(),
    approvedBy: int("approvedBy"),
    approvedAt: timestamp("approvedAt"),
    closedBy: int("closedBy"),
    closedAt: timestamp("closedAt"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("billing_cycle_status_idx").on(table.status),
    index("billing_cycle_period_idx").on(table.periodStart, table.periodEnd),
    index("billing_cycle_site_period_idx").on(table.siteId, table.periodStart),
  ],
);

export const meterReadings = mysqlTable(
  "meterReadings",
  {
    id: int("id").autoincrement().primaryKey(),
    billingCycleId: int("billingCycleId").notNull(),
    utilityMeterId: int("utilityMeterId").notNull(),
    previousReading: decimal("previousReading", { precision: 16, scale: 3 }).notNull(),
    currentReading: decimal("currentReading", { precision: 16, scale: 3 }).notNull(),
    multiplierSnapshot: decimal("multiplierSnapshot", { precision: 12, scale: 4 }).notNull(),
    readAt: timestamp("readAt").notNull(),
    sourceType: mysqlEnum("sourceType", recordSourceTypes).default("manual").notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("cycle_meter_reading_unique").on(table.billingCycleId, table.utilityMeterId)],
);

export const utilityInvoices = mysqlTable(
  "utilityInvoices",
  {
    id: int("id").autoincrement().primaryKey(),
    billingCycleId: int("billingCycleId").notNull(),
    invoiceNumber: varchar("invoiceNumber", { length: 96 }),
    invoiceIssuedAt: timestamp("invoiceIssuedAt"),
    officialKwh: decimal("officialKwh", { precision: 16, scale: 3 }),
    officialAmount: decimal("officialAmount", { precision: 18, scale: 2 }).notNull(),
    adjustmentAmount: decimal("adjustmentAmount", { precision: 18, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("utility_invoice_cycle_unique").on(table.billingCycleId)],
);

export const generators = mysqlTable(
  "generators",
  {
    id: int("id").autoincrement().primaryKey(),
    siteId: int("siteId"),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    ratedKva: decimal("ratedKva", { precision: 12, scale: 3 }),
    defaultPowerFactor: decimal("defaultPowerFactor", { precision: 6, scale: 4 }),
    acquisitionCost: decimal("acquisitionCost", { precision: 18, scale: 2 }),
    residualValue: decimal("residualValue", { precision: 18, scale: 2 }).default("0"),
    inServiceAt: timestamp("inServiceAt"),
    usefulLifeMonths: int("usefulLifeMonths"),
    usefulLifeHours: decimal("usefulLifeHours", { precision: 14, scale: 2 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("generator_code_unique").on(table.code), index("generator_site_idx").on(table.siteId)],
);

export const generatorRuns = mysqlTable(
  "generatorRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    billingCycleId: int("billingCycleId").notNull(),
    generatorId: int("generatorId").notNull(),
    startedAt: timestamp("startedAt").notNull(),
    endedAt: timestamp("endedAt").notNull(),
    runtimeHours: decimal("runtimeHours", { precision: 12, scale: 3 }).notNull(),
    measurementMode: mysqlEnum("measurementMode", measurementModes).notNull(),
    directKwh: decimal("directKwh", { precision: 14, scale: 3 }),
    averageKw: decimal("averageKw", { precision: 14, scale: 3 }),
    averageKva: decimal("averageKva", { precision: 14, scale: 3 }),
    powerFactor: decimal("powerFactor", { precision: 6, scale: 4 }),
    qualityStatus: mysqlEnum("qualityStatus", ["measured", "calculated", "estimated"])
      .default("measured")
      .notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("generator_run_cycle_idx").on(table.billingCycleId),
    index("generator_run_generator_idx").on(table.generatorId),
  ],
);

export const fuelTransactions = mysqlTable(
  "fuelTransactions",
  {
    id: int("id").autoincrement().primaryKey(),
    billingCycleId: int("billingCycleId").notNull(),
    generatorId: int("generatorId").notNull(),
    transactionType: mysqlEnum("transactionType", ["refuel", "consumption", "adjustment"]).notNull(),
    quantityLiters: decimal("quantityLiters", { precision: 14, scale: 3 }).notNull(),
    unitPrice: decimal("unitPrice", { precision: 16, scale: 4 }).notNull(),
    transactionAt: timestamp("transactionAt").notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("fuel_transaction_cycle_idx").on(table.billingCycleId)],
);

export const maintenanceRecords = mysqlTable(
  "maintenanceRecords",
  {
    id: int("id").autoincrement().primaryKey(),
    billingCycleId: int("billingCycleId"),
    generatorId: int("generatorId").notNull(),
    maintenanceType: varchar("maintenanceType", { length: 120 }).notNull(),
    performedAt: timestamp("performedAt").notNull(),
    actualCost: decimal("actualCost", { precision: 18, scale: 2 }).notNull(),
    expectedServiceHours: decimal("expectedServiceHours", { precision: 14, scale: 2 }),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("maintenance_generator_idx").on(table.generatorId)],
);

export const settingsVersions = mysqlTable(
  "settingsVersions",
  {
    id: int("id").autoincrement().primaryKey(),
    settingGroup: varchar("settingGroup", { length: 64 }).notNull(),
    settingKey: varchar("settingKey", { length: 128 }).notNull(),
    value: json("value").notNull(),
    effectiveFrom: timestamp("effectiveFrom").notNull(),
    effectiveTo: timestamp("effectiveTo"),
    changeReason: varchar("changeReason", { length: 255 }).notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("settings_lookup_idx").on(table.settingGroup, table.settingKey, table.effectiveFrom)],
);

export const calculationSnapshots = mysqlTable(
  "calculationSnapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    billingCycleId: int("billingCycleId").notNull(),
    calculationType: varchar("calculationType", { length: 64 }).notNull(),
    engineVersion: varchar("engineVersion", { length: 32 }).notNull(),
    inputs: json("inputs").notNull(),
    outputs: json("outputs").notNull(),
    warnings: json("warnings"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("calculation_snapshot_cycle_idx").on(table.billingCycleId)],
);

export const attachments = mysqlTable(
  "attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: int("entityId").notNull(),
    originalName: varchar("originalName", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    uploadedBy: int("uploadedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("attachment_entity_idx").on(table.entityType, table.entityId)],
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    actorUserId: int("actorUserId").notNull(),
    action: varchar("action", { length: 96 }).notNull(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: int("entityId"),
    beforeValue: json("beforeValue"),
    afterValue: json("afterValue"),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_entity_idx").on(table.entityType, table.entityId),
    index("audit_actor_idx").on(table.actorUserId, table.createdAt),
  ],
);

export const fuelProductTypes = ["diesel", "petrol", "kerosene", "other"] as const;
export const fuelInventoryStatuses = ["draft", "approved", "closed"] as const;
export const fuelInventoryResultTypes = ["surplus", "shortage", "balanced"] as const;
export const platformSections = ["energy", "fuel", "platform"] as const;
export const fuelSectionRoles = ["viewer", "operator", "supervisor", "accountant", "auditor"] as const;

export const sectionRoleGrants = mysqlTable(
  "sectionRoleGrants",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    section: mysqlEnum("section", platformSections).notNull(),
    role: mysqlEnum("role", fuelSectionRoles).notNull(),
    grantedBy: int("grantedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("section_role_grant_unique").on(table.userId, table.section, table.role),
    index("section_role_user_idx").on(table.userId, table.section),
  ],
);

export const permissionActions = ["view", "create", "update", "delete", "assign", "approve", "print", "export"] as const;
export const permissionEffects = ["allow", "deny"] as const;

export const userPermissions = mysqlTable(
  "userPermissions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    section: mysqlEnum("section", platformSections).notNull(),
    resource: varchar("resource", { length: 96 }).notNull(),
    action: mysqlEnum("action", permissionActions).notNull(),
    effect: mysqlEnum("effect", permissionEffects).default("allow").notNull(),
    grantedBy: int("grantedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("user_permission_unique").on(table.userId, table.section, table.resource, table.action),
    index("user_permission_user_idx").on(table.userId, table.section),
    index("user_permission_resource_idx").on(table.section, table.resource, table.action),
  ],
);

export const fuelProducts = mysqlTable(
  "fuelProducts",
  {
    id: int("id").autoincrement().primaryKey(),
    siteId: int("siteId"),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    fuelType: mysqlEnum("fuelType", fuelProductTypes).default("diesel").notNull(),
    tankCapacity: decimal("tankCapacity", { precision: 14, scale: 3 }).notNull(),
    literPerCm: decimal("literPerCm", { precision: 14, scale: 4 }).default("0").notNull(),
    expansionCoefficient: decimal("expansionCoefficient", { precision: 10, scale: 7 }).default("0.0006500").notNull(),
    referenceTemp: decimal("referenceTemp", { precision: 6, scale: 2 }).default("15").notNull(),
    openingBalance: decimal("openingBalance", { precision: 14, scale: 3 }).default("0").notNull(),
    openingDate: timestamp("openingDate"),
    lastMeterReading: decimal("lastMeterReading", { precision: 16, scale: 3 }).default("0").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("fuel_product_code_unique").on(table.code), index("fuel_product_site_idx").on(table.siteId)],
);

export const fuelSuppliers = mysqlTable(
  "fuelSuppliers",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    contactName: varchar("contactName", { length: 160 }),
    phone: varchar("phone", { length: 48 }),
    isActive: boolean("isActive").default(true).notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("fuel_supplier_name_unique").on(table.name)],
);

export const fuelReceipts = mysqlTable(
  "fuelReceipts",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    supplierId: int("supplierId"),
    invoiceNumber: varchar("invoiceNumber", { length: 96 }),
    receivedAt: timestamp("receivedAt").notNull(),
    quantityFromTruck: decimal("quantityFromTruck", { precision: 14, scale: 3 }).notNull(),
    quantityFromGauge: decimal("quantityFromGauge", { precision: 14, scale: 3 }).notNull(),
    temperature: decimal("temperature", { precision: 6, scale: 2 }).notNull(),
    correctedQuantity: decimal("correctedQuantity", { precision: 14, scale: 3 }).notNull(),
    pricePerLiter: decimal("pricePerLiter", { precision: 16, scale: 4 }).notNull(),
    totalAmount: decimal("totalAmount", { precision: 18, scale: 2 }).notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("fuel_receipt_product_date_idx").on(table.productId, table.receivedAt),
    index("fuel_receipt_supplier_idx").on(table.supplierId),
  ],
);

export const fuelIssues = mysqlTable(
  "fuelIssues",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    issuedAt: timestamp("issuedAt").notNull(),
    previousReading: decimal("previousReading", { precision: 16, scale: 3 }).notNull(),
    currentReading: decimal("currentReading", { precision: 16, scale: 3 }).notNull(),
    quantityIssued: decimal("quantityIssued", { precision: 14, scale: 3 }).notNull(),
    temperature: decimal("temperature", { precision: 6, scale: 2 }).notNull(),
    correctedQuantity: decimal("correctedQuantity", { precision: 14, scale: 3 }).notNull(),
    issuedTo: varchar("issuedTo", { length: 160 }).notNull(),
    vehicleNumber: varchar("vehicleNumber", { length: 96 }),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("fuel_issue_product_date_idx").on(table.productId, table.issuedAt)],
);

export const fuelWasteRecords = mysqlTable(
  "fuelWasteRecords",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    quantity: decimal("quantity", { precision: 14, scale: 3 }).notNull(),
    reason: varchar("reason", { length: 160 }).notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("fuel_waste_product_date_idx").on(table.productId, table.occurredAt)],
);

export const fuelInventoryClosures = mysqlTable(
  "fuelInventoryClosures",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    month: int("month").notNull(),
    year: int("year").notNull(),
    openingBalance: decimal("openingBalance", { precision: 14, scale: 3 }).notNull(),
    totalReceipts: decimal("totalReceipts", { precision: 14, scale: 3 }).notNull(),
    totalIssues: decimal("totalIssues", { precision: 14, scale: 3 }).notNull(),
    totalWaste: decimal("totalWaste", { precision: 14, scale: 3 }).notNull(),
    bookBalance: decimal("bookBalance", { precision: 14, scale: 3 }).notNull(),
    meterReadingStart: decimal("meterReadingStart", { precision: 16, scale: 3 }).notNull(),
    meterReadingEnd: decimal("meterReadingEnd", { precision: 16, scale: 3 }).notNull(),
    quantityIssuedByMeter: decimal("quantityIssuedByMeter", { precision: 14, scale: 3 }).notNull(),
    gaugeReadingCm: decimal("gaugeReadingCm", { precision: 12, scale: 3 }).notNull(),
    physicalBalance: decimal("physicalBalance", { precision: 14, scale: 3 }).notNull(),
    difference: decimal("difference", { precision: 14, scale: 3 }).notNull(),
    resultType: mysqlEnum("resultType", fuelInventoryResultTypes).notNull(),
    status: mysqlEnum("status", fuelInventoryStatuses).default("draft").notNull(),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    approvedBy: int("approvedBy"),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("fuel_inventory_period_unique").on(table.productId, table.year, table.month)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

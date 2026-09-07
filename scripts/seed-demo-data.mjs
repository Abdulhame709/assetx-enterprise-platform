import mysql from "mysql2/promise";

const DEMO = {
  siteCode: "DEMO-QA-SAN-26",
  siteName: "موقع صنعاء التجريبي — اختبار تكاملي",
  tariffName: "تعرفة تجربة التكامل — أغسطس 2026",
  meterCode: "DEMO-MTR-SAN-26",
  generatorOneCode: "DEMO-GEN-250-26",
  generatorTwoCode: "DEMO-GEN-150-26",
  productCode: "DEMO-DIESEL-SAN-26",
  supplierName: "مورد ديزل تجريبي — صنعاء",
  cycleOneTitle: "تجربة تكاملية — موقع صنعاء — الدورة الأولى أغسطس 2026",
  cycleTwoTitle: "تجربة تكاملية — موقع صنعاء — الدورة الثانية أغسطس 2026",
};

const at = (day, hour = 0, minute = 0) => new Date(Date.UTC(2026, 7, day, hour, minute));
const iso = date => date.toISOString().slice(0, 19).replace("T", " ");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL غير متاح؛ شغّل السكربت من بيئة المشروع.");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const queryOne = async (sql, params = []) => {
  const [rows] = await connection.execute(sql, params);
  return rows[0] ?? null;
};
const execute = (sql, params = []) => connection.execute(sql, params);
const idFor = async (table, column, value) => {
  const row = await queryOne(`SELECT id FROM ${table} WHERE ${column} = ? ORDER BY id ASC LIMIT 1`, [value]);
  if (!row) throw new Error(`تعذر تحديد السجل في ${table}.`);
  return Number(row.id);
};
const ensureEvent = async ({ alertKey, userId, siteId, action, note, createdAt }) => {
  const existing = await queryOne("SELECT id FROM alertActionHistory WHERE alertKey = ? AND action = ? AND note = ? ORDER BY id ASC LIMIT 1", [alertKey, action, note]);
  if (!existing) await execute("INSERT INTO alertActionHistory (alertKey, userId, siteId, action, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)", [alertKey, userId, siteId, action, note, createdAt]);
};
const ensureRun = async values => {
  const existing = await queryOne("SELECT id FROM generatorRuns WHERE billingCycleId = ? AND generatorId = ? AND notes = ? ORDER BY id ASC LIMIT 1", [values.billingCycleId, values.generatorId, values.notes]);
  if (!existing) await execute("INSERT INTO generatorRuns (billingCycleId, generatorId, startedAt, endedAt, runtimeHours, measurementMode, directKwh, averageKw, averageKva, powerFactor, qualityStatus, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [values.billingCycleId, values.generatorId, values.startedAt, values.endedAt, values.runtimeHours, values.measurementMode, values.directKwh, values.averageKw, values.averageKva, values.powerFactor, values.qualityStatus, values.notes, values.createdBy]);
};
const ensureFuelTransaction = async values => {
  const existing = await queryOne("SELECT id FROM fuelTransactions WHERE billingCycleId = ? AND generatorId = ? AND notes = ? ORDER BY id ASC LIMIT 1", [values.billingCycleId, values.generatorId, values.notes]);
  if (!existing) await execute("INSERT INTO fuelTransactions (billingCycleId, generatorId, transactionType, quantityLiters, unitPrice, transactionAt, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [values.billingCycleId, values.generatorId, values.transactionType, values.quantityLiters, values.unitPrice, values.transactionAt, values.notes, values.createdBy]);
};
const ensureMaintenance = async values => {
  const existing = await queryOne("SELECT id FROM maintenanceRecords WHERE billingCycleId = ? AND generatorId = ? AND maintenanceType = ? AND notes = ? ORDER BY id ASC LIMIT 1", [values.billingCycleId, values.generatorId, values.maintenanceType, values.notes]);
  if (!existing) await execute("INSERT INTO maintenanceRecords (billingCycleId, generatorId, maintenanceType, performedAt, actualCost, expectedServiceHours, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [values.billingCycleId, values.generatorId, values.maintenanceType, values.performedAt, values.actualCost, values.expectedServiceHours, values.notes, values.createdBy]);
  return Number((await queryOne("SELECT id FROM maintenanceRecords WHERE billingCycleId = ? AND generatorId = ? AND maintenanceType = ? AND notes = ? ORDER BY id ASC LIMIT 1", [values.billingCycleId, values.generatorId, values.maintenanceType, values.notes])).id);
};

try {
  await connection.beginTransaction();
  const owner = await queryOne("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  if (!owner) throw new Error("لا يوجد مستخدم إداري لربط بيانات التجربة به.");
  const ownerId = Number(owner.id);

  await execute("INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), role = VALUES(role), lastSignedIn = VALUES(lastSignedIn)", ["demo-energy-operator-2026", "فني الطاقة التجريبي", "demo.energy@example.invalid", "demo_seed", "energy_operator", at(27, 8)]);
  await execute("INSERT INTO users (openId, name, email, loginMethod, role, lastSignedIn) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), role = VALUES(role), lastSignedIn = VALUES(lastSignedIn)", ["demo-maintenance-lead-2026", "مسؤول الصيانة التجريبي", "demo.maintenance@example.invalid", "demo_seed", "maintenance", at(27, 8)]);
  const energyOperatorId = await idFor("users", "openId", "demo-energy-operator-2026");
  const maintenanceLeadId = await idFor("users", "openId", "demo-maintenance-lead-2026");

  await execute("INSERT INTO sites (code, name, city, address, isActive, createdBy) VALUES (?, ?, ?, ?, TRUE, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), city = VALUES(city), address = VALUES(address), isActive = TRUE", [DEMO.siteCode, DEMO.siteName, "صنعاء", "بيئة بيانات معزولة لاختبار المنصة", ownerId]);
  const siteId = await idFor("sites", "code", DEMO.siteCode);
  for (const [userId, section, accessLevel] of [[energyOperatorId, "energy", "operator"], [maintenanceLeadId, "energy", "supervisor"], [energyOperatorId, "fuel", "operator"], [maintenanceLeadId, "fuel", "supervisor"]]) {
    await execute("INSERT IGNORE INTO siteRoleGrants (userId, siteId, section, accessLevel, grantedBy) VALUES (?, ?, ?, ?, ?)", [userId, siteId, section, accessLevel, ownerId]);
  }
  for (const [userId, role] of [[energyOperatorId, "operator"], [maintenanceLeadId, "supervisor"]]) {
    await execute("INSERT IGNORE INTO sectionRoleGrants (userId, section, role, grantedBy) VALUES (?, 'fuel', ?, ?)", [userId, role, ownerId]);
  }

  let tariff = await queryOne("SELECT id FROM tariffVersions WHERE name = ? ORDER BY id ASC LIMIT 1", [DEMO.tariffName]);
  if (!tariff) {
    const [result] = await execute("INSERT INTO tariffVersions (name, pricingMode, effectiveFrom, isActive, createdBy) VALUES (?, 'whole_cycle_rate', ?, TRUE, ?)", [DEMO.tariffName, at(1), ownerId]);
    tariff = { id: result.insertId };
  }
  const tariffId = Number(tariff.id);
  const brackets = [[1, 1, 2999, 230], [2, 3000, 9999, 220], [3, 10000, 19999, 200], [4, 20000, 29999, 190], [5, 30000, 99999, 185], [6, 100000, 199999, 180], [7, 200000, 299999, 175], [8, 300000, null, 170]];
  for (const [sequence, minKwh, maxKwh, unitRate] of brackets) {
    await execute("INSERT INTO tariffBrackets (tariffVersionId, sequence, minKwh, maxKwh, unitRate) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE minKwh = VALUES(minKwh), maxKwh = VALUES(maxKwh), unitRate = VALUES(unitRate)", [tariffId, sequence, minKwh, maxKwh, unitRate]);
  }
  const setting = await queryOne("SELECT id FROM settingsVersions WHERE settingGroup = 'demo' AND settingKey = 'integration_scenario_2026_08' ORDER BY id ASC LIMIT 1");
  const settingValue = JSON.stringify({ label: "بيانات تجربة تكاملية", siteCode: DEMO.siteCode, seededAt: iso(at(28, 0)) });
  if (setting) await execute("UPDATE settingsVersions SET value = ?, changeReason = ? WHERE id = ?", [settingValue, "تحديث سيناريو بيانات التجربة", Number(setting.id)]);
  else await execute("INSERT INTO settingsVersions (settingGroup, settingKey, value, effectiveFrom, changeReason, createdBy) VALUES ('demo', 'integration_scenario_2026_08', ?, ?, ?, ?)", [settingValue, at(1), "إنشاء سيناريو بيانات التجربة", ownerId]);

  await execute("INSERT INTO utilityMeters (siteId, code, name, multiplier, isActive) VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE siteId = VALUES(siteId), name = VALUES(name), multiplier = VALUES(multiplier), isActive = TRUE", [siteId, DEMO.meterCode, "عداد المؤسسة التجريبي — مبنى الإدارة", "2"]);
  const meterId = await idFor("utilityMeters", "code", DEMO.meterCode);
  await execute("INSERT INTO generators (siteId, code, name, ratedKva, defaultPowerFactor, acquisitionCost, residualValue, inServiceAt, usefulLifeMonths, usefulLifeHours, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE siteId = VALUES(siteId), name = VALUES(name), ratedKva = VALUES(ratedKva), defaultPowerFactor = VALUES(defaultPowerFactor), acquisitionCost = VALUES(acquisitionCost), residualValue = VALUES(residualValue), usefulLifeMonths = VALUES(usefulLifeMonths), usefulLifeHours = VALUES(usefulLifeHours), isActive = TRUE", [siteId, DEMO.generatorOneCode, "مولد تجريبي كبير 250 kVA", "250", "0.8", "18000000", "1500000", at(1), 120, "20000"]);
  await execute("INSERT INTO generators (siteId, code, name, ratedKva, defaultPowerFactor, acquisitionCost, residualValue, inServiceAt, usefulLifeMonths, usefulLifeHours, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE siteId = VALUES(siteId), name = VALUES(name), ratedKva = VALUES(ratedKva), defaultPowerFactor = VALUES(defaultPowerFactor), acquisitionCost = VALUES(acquisitionCost), residualValue = VALUES(residualValue), usefulLifeMonths = VALUES(usefulLifeMonths), usefulLifeHours = VALUES(usefulLifeHours), isActive = TRUE", [siteId, DEMO.generatorTwoCode, "مولد تجريبي مساعد 150 kVA", "150", "0.82", "12000000", "1000000", at(1), 120, "16000"]);
  const generatorOneId = await idFor("generators", "code", DEMO.generatorOneCode);
  const generatorTwoId = await idFor("generators", "code", DEMO.generatorTwoCode);

  const cycles = [
    { title: DEMO.cycleOneTitle, start: at(1), end: at(15, 23, 59), costModel: "full", depreciationMode: "accounting", maintenanceMode: "actual" },
    { title: DEMO.cycleTwoTitle, start: at(16), end: at(27, 23, 59), costModel: "full", depreciationMode: "operational", maintenanceMode: "allocated" },
  ];
  const cycleIds = [];
  for (const cycle of cycles) {
    const existing = await queryOne("SELECT id FROM billingCycles WHERE siteId = ? AND title = ? ORDER BY id ASC LIMIT 1", [siteId, cycle.title]);
    if (existing) await execute("UPDATE billingCycles SET periodStart = ?, periodEnd = ?, status = 'data_entry', tariffVersionId = ?, selectedCostModel = ?, depreciationMode = ?, maintenanceMode = ? WHERE id = ?", [cycle.start, cycle.end, tariffId, cycle.costModel, cycle.depreciationMode, cycle.maintenanceMode, Number(existing.id)]);
    else await execute("INSERT INTO billingCycles (siteId, title, periodStart, periodEnd, status, tariffVersionId, selectedCostModel, depreciationMode, maintenanceMode, createdBy) VALUES (?, ?, ?, ?, 'data_entry', ?, ?, ?, ?, ?)", [siteId, cycle.title, cycle.start, cycle.end, tariffId, cycle.costModel, cycle.depreciationMode, cycle.maintenanceMode, ownerId]);
    cycleIds.push(Number((await queryOne("SELECT id FROM billingCycles WHERE siteId = ? AND title = ? ORDER BY id ASC LIMIT 1", [siteId, cycle.title])).id));
  }
  const [cycleOneId, cycleTwoId] = cycleIds;

  const readings = [[cycleOneId, 10000, 15000, at(15, 12), "قراءة تجربة أولى: 10,000 kWh بعد معامل العداد"], [cycleTwoId, 15000, 22000, at(27, 12), "قراءة تجربة ثانية: 14,000 kWh بعد معامل العداد"]];
  for (const [cycleId, previousReading, currentReading, readAt, notes] of readings) await execute("INSERT INTO meterReadings (billingCycleId, utilityMeterId, previousReading, currentReading, multiplierSnapshot, readAt, sourceType, notes, createdBy) VALUES (?, ?, ?, ?, '2', ?, 'meter', ?, ?) ON DUPLICATE KEY UPDATE previousReading = VALUES(previousReading), currentReading = VALUES(currentReading), multiplierSnapshot = VALUES(multiplierSnapshot), readAt = VALUES(readAt), sourceType = VALUES(sourceType), notes = VALUES(notes), createdBy = VALUES(createdBy)", [cycleId, meterId, previousReading, currentReading, readAt, notes, ownerId]);
  const invoices = [[cycleOneId, "DEMO-UTIL-2026-08-A", 10000, 2000000, 0, "فاتورة تجريبية مطابقة للحساب التحليلي"], [cycleTwoId, "DEMO-UTIL-2026-08-B", 14000, 2870000, 70000, "فاتورة تجريبية تتضمن فرق تسوية ظاهر للاختبار"]];
  for (const [cycleId, invoiceNumber, officialKwh, officialAmount, adjustmentAmount, notes] of invoices) await execute("INSERT INTO utilityInvoices (billingCycleId, invoiceNumber, invoiceIssuedAt, officialKwh, officialAmount, adjustmentAmount, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE invoiceNumber = VALUES(invoiceNumber), invoiceIssuedAt = VALUES(invoiceIssuedAt), officialKwh = VALUES(officialKwh), officialAmount = VALUES(officialAmount), adjustmentAmount = VALUES(adjustmentAmount), notes = VALUES(notes), createdBy = VALUES(createdBy)", [cycleId, invoiceNumber, at(cycleId === cycleOneId ? 15 : 27, 15), officialKwh, officialAmount, adjustmentAmount, notes, ownerId]);

  await ensureRun({ billingCycleId: cycleOneId, generatorId: generatorOneId, startedAt: at(4, 8), endedAt: at(4, 18), runtimeHours: "10", measurementMode: "kwh", directKwh: "1800", averageKw: null, averageKva: null, powerFactor: null, qualityStatus: "measured", notes: "تشغيل تجريبي أول — قياس مباشر kWh", createdBy: ownerId });
  await ensureRun({ billingCycleId: cycleOneId, generatorId: generatorTwoId, startedAt: at(8, 7), endedAt: at(8, 19), runtimeHours: "12", measurementMode: "kw", directKwh: null, averageKw: "100", averageKva: null, powerFactor: null, qualityStatus: "calculated", notes: "تشغيل تجريبي أول — تحويل kW إلى kWh", createdBy: ownerId });
  await ensureRun({ billingCycleId: cycleTwoId, generatorId: generatorOneId, startedAt: at(18, 8), endedAt: at(18, 14), runtimeHours: "6", measurementMode: "kwh", directKwh: "800", averageKw: null, averageKva: null, powerFactor: null, qualityStatus: "measured", notes: "تشغيل تجريبي ثانٍ — قياس مباشر kWh", createdBy: ownerId });
  await ensureRun({ billingCycleId: cycleTwoId, generatorId: generatorOneId, startedAt: at(20, 7), endedAt: at(20, 21), runtimeHours: "14", measurementMode: "kva", directKwh: null, averageKw: null, averageKva: "130", powerFactor: "0.8", qualityStatus: "calculated", notes: "تشغيل تجريبي ثانٍ — تحويل kVA بعامل قدرة 0.8", createdBy: ownerId });
  await ensureRun({ billingCycleId: cycleTwoId, generatorId: generatorTwoId, startedAt: at(23, 8), endedAt: at(23, 20), runtimeHours: "12", measurementMode: "kwh", directKwh: "2800", averageKw: null, averageKva: null, powerFactor: null, qualityStatus: "measured", notes: "تشغيل تجريبي ثانٍ للمولد المساعد", createdBy: ownerId });
  await ensureFuelTransaction({ billingCycleId: cycleOneId, generatorId: generatorOneId, transactionType: "consumption", quantityLiters: "500", unitPrice: "1100", transactionAt: at(4, 18), notes: "تكلفة وقود تجربة الدورة الأولى", createdBy: ownerId });
  await ensureFuelTransaction({ billingCycleId: cycleTwoId, generatorId: generatorOneId, transactionType: "consumption", quantityLiters: "550", unitPrice: "1100", transactionAt: at(23, 20), notes: "تكلفة وقود تجربة الدورة الثانية", createdBy: ownerId });
  await ensureMaintenance({ billingCycleId: cycleOneId, generatorId: generatorTwoId, maintenanceType: "صيانة وقائية تجريبية", performedAt: at(9, 12), actualCost: "90000", expectedServiceHours: "150", notes: "صيانة فعلية لاختبار نموذج التكلفة النقدية والكاملة", createdBy: ownerId });
  const maintenanceTwoId = await ensureMaintenance({ billingCycleId: cycleTwoId, generatorId: generatorOneId, maintenanceType: "صيانة دورية تجريبية", performedAt: at(16, 6), actualCost: "120000", expectedServiceHours: "20", notes: "صيانة ذات حد ساعات منخفض لاختبار تنبيه الصيانة", createdBy: ownerId });

  await execute("INSERT INTO fuelProducts (siteId, code, name, fuelType, tankCapacity, literPerCm, expansionCoefficient, referenceTemp, openingBalance, openingDate, lastMeterReading, isActive, notes, createdBy) VALUES (?, ?, ?, 'diesel', ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?) ON DUPLICATE KEY UPDATE siteId = VALUES(siteId), name = VALUES(name), tankCapacity = VALUES(tankCapacity), literPerCm = VALUES(literPerCm), openingBalance = VALUES(openingBalance), openingDate = VALUES(openingDate), lastMeterReading = VALUES(lastMeterReading), isActive = TRUE, notes = VALUES(notes)", [siteId, DEMO.productCode, "ديزل تجريبي — خزان صنعاء", "5000", "100", "0.0006500", "15", "1200", at(1), "2210", "رصيد منخفض مقصود لاختبار التنبيه", ownerId]);
  const productId = await idFor("fuelProducts", "code", DEMO.productCode);
  await execute("INSERT INTO fuelSuppliers (name, contactName, phone, isActive, notes, createdBy) VALUES (?, ?, ?, TRUE, ?, ?) ON DUPLICATE KEY UPDATE contactName = VALUES(contactName), phone = VALUES(phone), isActive = TRUE, notes = VALUES(notes)", [DEMO.supplierName, "مورد اختبار", "000000000", "مورد مخصص لبيانات التجربة", ownerId]);
  const supplierId = await idFor("fuelSuppliers", "name", DEMO.supplierName);
  const receipt = await queryOne("SELECT id FROM fuelReceipts WHERE productId = ? AND invoiceNumber = ? ORDER BY id ASC LIMIT 1", [productId, "DEMO-FUEL-REC-2026-08"]);
  if (!receipt) await execute("INSERT INTO fuelReceipts (productId, supplierId, invoiceNumber, receivedAt, quantityFromTruck, quantityFromGauge, temperature, correctedQuantity, pricePerLiter, totalAmount, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [productId, supplierId, "DEMO-FUEL-REC-2026-08", at(17, 9), "400", "400", "29", "400", "1100", "440000", "توريد تجربة لاختبار الاستلام وتصحيح الكمية", ownerId]);
  const issue = await queryOne("SELECT id FROM fuelIssues WHERE productId = ? AND issuedTo = ? AND notes = ? ORDER BY id ASC LIMIT 1", [productId, "مولدات الموقع التجريبية", "صرف تجربة لاختبار رصيد الخزان"]);
  if (!issue) await execute("INSERT INTO fuelIssues (productId, issuedAt, previousReading, currentReading, quantityIssued, temperature, correctedQuantity, issuedTo, vehicleNumber, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [productId, at(24, 16), "1000", "2210", "1210", "28", "1210", "مولدات الموقع التجريبية", "DEMO-GEN", "صرف تجربة لاختبار رصيد الخزان", ownerId]);
  const waste = await queryOne("SELECT id FROM fuelWasteRecords WHERE productId = ? AND reason = ? AND notes = ? ORDER BY id ASC LIMIT 1", [productId, "فاقد اختبار معايرة", "فاقد مقصود لاختبار فرق الجرد"]);
  if (!waste) await execute("INSERT INTO fuelWasteRecords (productId, occurredAt, quantity, reason, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?)", [productId, at(25, 14), "70", "فاقد اختبار معايرة", "فاقد مقصود لاختبار فرق الجرد", ownerId]);
  await execute("INSERT INTO fuelInventoryClosures (productId, month, year, openingBalance, totalReceipts, totalIssues, totalWaste, bookBalance, meterReadingStart, meterReadingEnd, quantityIssuedByMeter, gaugeReadingCm, physicalBalance, difference, resultType, status, notes, createdBy) VALUES (?, 8, 2026, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shortage', 'approved', ?, ?) ON DUPLICATE KEY UPDATE openingBalance = VALUES(openingBalance), totalReceipts = VALUES(totalReceipts), totalIssues = VALUES(totalIssues), totalWaste = VALUES(totalWaste), bookBalance = VALUES(bookBalance), meterReadingStart = VALUES(meterReadingStart), meterReadingEnd = VALUES(meterReadingEnd), quantityIssuedByMeter = VALUES(quantityIssuedByMeter), gaugeReadingCm = VALUES(gaugeReadingCm), physicalBalance = VALUES(physicalBalance), difference = VALUES(difference), resultType = VALUES(resultType), status = VALUES(status), notes = VALUES(notes), createdBy = VALUES(createdBy)", [productId, "1200", "400", "1210", "70", "320", "1000", "2210", "1210", "2.35", "235", "-85", "جرد تجريبي بفارق مقصود لإظهار تنبيه المخزون", ownerId]);
  const closureId = Number((await queryOne("SELECT id FROM fuelInventoryClosures WHERE productId = ? AND month = 8 AND year = 2026 ORDER BY id ASC LIMIT 1", [productId])).id);

  const fuelAlertKey = `fuel-low:${productId}`;
  const inventoryAlertKey = `inventory-variance:${closureId}`;
  const maintenanceAlertKey = `maintenance-due:${generatorOneId}:${maintenanceTwoId}`;
  const costAlertKey = `cost-decision:${cycleTwoId}`;
  const assignments = [
    [fuelAlertKey, energyOperatorId, at(29, 12), "معالجة الرصيد الحرج خلال يوم العمل التالي"],
    [inventoryAlertKey, maintenanceLeadId, at(25, 12), "مراجعة فرق الجرد واعتماد سبب المعايرة"],
    [maintenanceAlertKey, maintenanceLeadId, at(28, 14), "جدولة الصيانة الدورية بعد بلوغ ساعات التشغيل"],
  ];
  for (const [alertKey, assignedToUserId, dueAt, note] of assignments) await execute("INSERT INTO alertAssignments (alertKey, siteId, assignedToUserId, assignedByUserId, dueAt, note) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE siteId = VALUES(siteId), assignedToUserId = VALUES(assignedToUserId), assignedByUserId = VALUES(assignedByUserId), dueAt = VALUES(dueAt), note = VALUES(note)", [alertKey, siteId, assignedToUserId, ownerId, dueAt, note]);
  await execute("INSERT INTO alertResolutions (alertKey, userId, siteId, status, note) VALUES (?, ?, ?, 'acknowledged', ?) ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note)", [fuelAlertKey, ownerId, siteId, "بدأ الفني التجريبي متابعة الرصيد الحرج"]);
  await execute("INSERT INTO alertResolutions (alertKey, userId, siteId, status, note) VALUES (?, ?, ?, 'resolved', ?) ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note)", [inventoryAlertKey, ownerId, siteId, "تمت مراجعة فرق الجرد التجريبي وإغلاقه"]);
  await ensureEvent({ alertKey: fuelAlertKey, userId: ownerId, siteId, action: "assigned", note: "تعيين فني الطاقة التجريبي لمعالجة الرصيد المنخفض", createdAt: at(27, 8) });
  await ensureEvent({ alertKey: fuelAlertKey, userId: energyOperatorId, siteId, action: "acknowledged", note: "تمت معاينة الخزان وبدأت متابعة التوريد التجريبي", createdAt: at(27, 10) });
  await ensureEvent({ alertKey: inventoryAlertKey, userId: ownerId, siteId, action: "assigned", note: "تعيين مسؤول الصيانة التجريبي لمراجعة فرق الجرد", createdAt: at(24, 9) });
  await ensureEvent({ alertKey: inventoryAlertKey, userId: maintenanceLeadId, siteId, action: "resolved", note: "أغلق فرق الجرد بعد توثيق معايرة الخزان التجريبية", createdAt: at(27, 11) });
  await ensureEvent({ alertKey: maintenanceAlertKey, userId: ownerId, siteId, action: "assigned", note: "تعيين مسؤول الصيانة التجريبي لجدولة الصيانة الدورية", createdAt: at(27, 13) });
  await ensureEvent({ alertKey: costAlertKey, userId: ownerId, siteId, action: "acknowledged", note: "تمت مراجعة توصية المصدر الأقل تكلفة للدورة التجريبية", createdAt: at(27, 16) });
  const seedAudit = await queryOne("SELECT id FROM auditLogs WHERE action = 'demo_seed:integration_2026_08' AND entityType = 'demoScenario' ORDER BY id ASC LIMIT 1");
  if (!seedAudit) await execute("INSERT INTO auditLogs (actorUserId, action, entityType, entityId, afterValue, reason) VALUES (?, 'demo_seed:integration_2026_08', 'demoScenario', ?, ?, ?)", [ownerId, siteId, JSON.stringify({ siteCode: DEMO.siteCode, cycleIds: [cycleOneId, cycleTwoId], productId }), "إنشاء بيانات تجربة مترابطة دون حذف سجلات قائمة"]);

  await connection.commit();
  console.table([{ siteId, tariffId, meterId, cycleOneId, cycleTwoId, generatorOneId, generatorTwoId, productId, closureId, maintenanceTwoId }]);
  console.log("تم إنشاء أو تحديث بيانات التجربة المعزولة بنجاح. يمكن إعادة تشغيل السكربت بأمان دون تكرار السجلات ذات العلامة التجريبية.");
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.destroy();
}

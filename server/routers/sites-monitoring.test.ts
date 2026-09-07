import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async importOriginal => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    assignAlert: vi.fn(),
    createSite: vi.fn(),
    getAlertCenter: vi.fn(),
    getGrantedSiteIds: vi.fn(),
    getSiteDecisionBoard: vi.fn(),
    getTeamAlertActivity: vi.fn(),
    listAlertAssignees: vi.fn(),
    listSiteRoleGrants: vi.fn(),
    listSites: vi.fn(),
    replaceSiteRoleGrants: vi.fn(),
    setAlertResolution: vi.fn(),
    updateSite: vi.fn(),
  };
});

import { assignAlert, getAlertCenter, getGrantedSiteIds, getSiteDecisionBoard, getTeamAlertActivity, listAlertAssignees, listSites, replaceSiteRoleGrants, setAlertResolution } from "../db";
import { monitoringRouter } from "./monitoring";
import { sitesRouter } from "./sites";

const mockedAlerts = vi.mocked(getAlertCenter);
const mockedAssignAlert = vi.mocked(assignAlert);
const mockedGrantedSites = vi.mocked(getGrantedSiteIds);
const mockedDecisions = vi.mocked(getSiteDecisionBoard);
const mockedActivity = vi.mocked(getTeamAlertActivity);
const mockedAssignees = vi.mocked(listAlertAssignees);
const mockedListSites = vi.mocked(listSites);
const mockedReplaceGrants = vi.mocked(replaceSiteRoleGrants);
const mockedSetResolution = vi.mocked(setAlertResolution);

function context(role: "admin" | "management"): TrpcContext {
  return { user: { id: 41, openId: "site-user", name: "مستخدم", email: "user@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("المواقع والتنبيهات المقيدة", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يقصر إدارة المواقع واستبدال منحها على المدير", async () => {
    const caller = sitesRouter.createCaller(context("management"));
    await expect(caller.manage.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.manage.grants.replace({ userId: 5, grants: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedListSites).not.toHaveBeenCalled();
    expect(mockedReplaceGrants).not.toHaveBeenCalled();
  });

  it("يعرض للمستخدم مواقع المنح فقط", async () => {
    mockedListSites.mockResolvedValue([
      { id: 1, code: "MAIN", name: "الرئيسي", city: null, address: null, isActive: true, createdBy: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, code: "ADEN", name: "عدن", city: null, address: null, isActive: true, createdBy: 1, createdAt: new Date(), updatedAt: new Date() },
    ]);
    mockedGrantedSites.mockResolvedValueOnce([2]).mockResolvedValueOnce([]);
    const caller = sitesRouter.createCaller(context("management"));
    await expect(caller.accessible()).resolves.toEqual([expect.objectContaining({ id: 2, code: "ADEN" })]);
  });

  it("يرفض معالجة تنبيه خارج نطاق موقع المستخدم", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    mockedAlerts.mockResolvedValue({ alerts: [{ key: "fuel-low:2", siteId: 2, severity: "warning", status: "open", type: "fuel", title: "تنبيه", message: "رسالة", siteName: "عدن", createdAt: new Date() }], summary: { critical: 0, warning: 1, open: 1 } });
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.alerts.resolve({ alertKey: "fuel-low:2", siteId: 2, status: "resolved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedSetResolution).not.toHaveBeenCalled();
  });

  it("يستخدم موقع التنبيه الفعلي عند معالجته ضمن النطاق", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    mockedAlerts.mockResolvedValue({ alerts: [{ key: "fuel-low:1", siteId: 1, severity: "warning", status: "open", type: "fuel", title: "تنبيه", message: "رسالة", siteName: "الرئيسي", createdAt: new Date() }], summary: { critical: 0, warning: 1, open: 1 } });
    mockedSetResolution.mockResolvedValue({ success: true });
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.alerts.resolve({ alertKey: "fuel-low:1", siteId: null, status: "acknowledged", note: "تمت المراجعة" })).resolves.toEqual({ success: true });
    expect(mockedSetResolution).toHaveBeenCalledWith({ alertKey: "fuel-low:1", userId: 41, siteId: 1, status: "acknowledged", note: "تمت المراجعة" });
  });

  it("يعيد فتح التنبيه المحلول كحالة متابعة مع تسجيل الإجراء", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    mockedAlerts.mockResolvedValue({ alerts: [{ key: "fuel-low:1", siteId: 1, severity: "warning", status: "resolved", type: "fuel", title: "تنبيه", message: "رسالة", siteName: "الرئيسي", createdAt: new Date() }], summary: { total: 1, critical: 0, warning: 0, open: 0, acknowledged: 0, resolved: 1 } });
    mockedSetResolution.mockResolvedValue({ success: true });
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.alerts.resolve({ alertKey: "fuel-low:1", siteId: 1, status: "reopened", note: "تكرر النقص" })).resolves.toEqual({ success: true });
    expect(mockedSetResolution).toHaveBeenCalledWith({ alertKey: "fuel-low:1", userId: 41, siteId: 1, status: "acknowledged", action: "reopened", note: "تكرر النقص" });
  });

  it("يمرر فلاتر التنبيهات المصرح بها إلى طبقة البيانات", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    mockedAlerts.mockResolvedValue({ alerts: [], summary: { total: 0, critical: 0, warning: 0, open: 0, acknowledged: 0, resolved: 0 } });
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.alerts.list({ siteId: 1, type: "maintenance", severity: "warning", status: "open" })).resolves.toEqual(expect.objectContaining({ alerts: [] }));
    expect(mockedAlerts).toHaveBeenCalledWith({ userId: 41, siteIds: [1], siteId: 1, type: "maintenance", severity: "warning", status: "open" });
  });

  it("يرفض طلب فلاتر التنبيهات أو لوحة القرار لموقع خارج نطاق المستخدم", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.alerts.list({ siteId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.decisions({ siteId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedAlerts).not.toHaveBeenCalled();
    expect(mockedDecisions).not.toHaveBeenCalled();
  });

  it("يقصر قائمة المرشحين وسجل الفريق على المواقع الممنوحة", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    mockedAssignees.mockResolvedValue([{ id: 6, name: "فني الموقع", role: "maintenance" }]);
    mockedActivity.mockResolvedValue([]);
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.alerts.assignees({ siteId: 1 })).resolves.toEqual([expect.objectContaining({ id: 6 })]);
    await expect(caller.activity.list({ siteId: 1, action: "assigned" })).resolves.toEqual([]);
    expect(mockedActivity).toHaveBeenCalledWith({ siteIds: [1], siteId: 1, action: "assigned" });
    await expect(caller.alerts.assignees({ siteId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمرر فلاتر وفرز سجل الفريق المتقدمة ضمن نطاق المواقع الممنوحة", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    mockedActivity.mockResolvedValue([]);
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.activity.list({ siteId: 1, assignedToUserId: 6, responseStatus: "acknowledged", query: "فني الموقع", sort: "due_soonest" })).resolves.toEqual([]);
    expect(mockedActivity).toHaveBeenCalledWith({ siteIds: [1], siteId: 1, assignedToUserId: 6, responseStatus: "acknowledged", query: "فني الموقع", sort: "due_soonest" });
    await expect(caller.activity.list({ siteId: 2, query: "عدن" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedActivity).toHaveBeenCalledTimes(1);
  });

  it("يعيّن مسؤولًا لتنبيه ضمن نطاق الموقع فقط", async () => {
    mockedGrantedSites.mockResolvedValue([1]);
    mockedAlerts.mockResolvedValue({ alerts: [{ key: "maintenance-due:1:2", siteId: 1, severity: "warning", status: "open", type: "maintenance", title: "صيانة", message: "رسالة", siteName: "الرئيسي", createdAt: new Date() }], summary: { total: 1, critical: 0, warning: 1, open: 1, acknowledged: 0, resolved: 0 } });
    mockedAssignAlert.mockResolvedValue({ success: true });
    const caller = monitoringRouter.createCaller(context("management"));
    await expect(caller.alerts.assign({ alertKey: "maintenance-due:1:2", siteId: 1, assignedToUserId: 6, dueAt: 1_800_000_000_000, note: "خلال الوردية" })).resolves.toEqual({ success: true });
    expect(mockedAssignAlert).toHaveBeenCalledWith(expect.objectContaining({ alertKey: "maintenance-due:1:2", siteId: 1, assignedToUserId: 6, assignedByUserId: 41, note: "خلال الوردية" }));
    await expect(caller.alerts.assign({ alertKey: "maintenance-due:1:2", siteId: 2, assignedToUserId: 6, dueAt: 1_800_000_000_000 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

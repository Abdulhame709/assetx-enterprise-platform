import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { lazy, Suspense, type ReactNode } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PlatformLoading, WorkspacePageLoading } from "./components/WorkspaceLoading";

const Home = lazy(() => import("./pages/Home"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const BillingCyclesPage = lazy(() => import("./pages/BillingCyclesPage"));
const OperationsPage = lazy(() => import("./pages/OperationsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const InvoiceTesterPage = lazy(() => import("./pages/InvoiceTesterPage"));
const SectionPortalPage = lazy(() => import("./pages/SectionPortalPage"));
const FuelLandingPage = lazy(() => import("./pages/FuelLandingPage"));
const FuelRoleAuditPage = lazy(() => import("./pages/FuelRoleAuditPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const DailyDecisionsPage = lazy(() => import("./pages/DailyDecisionsPage"));
const SitesPage = lazy(() => import("./pages/SitesPage"));
const TeamActivityPage = lazy(() => import("./pages/TeamActivityPage"));
const DemoScenarioReportPage = lazy(() => import("./pages/DemoScenarioReportPage"));

function RouteTransition({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <div key={location} className="page-transition">{children}</div>;
}

function EnergyRoutes() {
  return <DashboardLayout><RouteTransition><Suspense fallback={<WorkspacePageLoading label="جارٍ تحميل واجهة الطاقة" />}><Switch>
    <Route path="/energy" component={Home} />
    <Route path="/energy/cycles" component={BillingCyclesPage} />
    <Route path="/energy/operations" component={OperationsPage} />
    <Route path="/energy/reports" component={ReportsPage} />
    <Route path="/energy/demo-report" component={DemoScenarioReportPage} />
    <Route path="/energy/analysis" component={AnalysisPage} />
    <Route path="/energy/invoice-test" component={InvoiceTesterPage} />
    <Route path="/energy/settings" component={SettingsPage} />
    <Route path="/energy/users" component={UsersPage} />
    <Route path="/energy/alerts" component={AlertsPage} />
    <Route path="/energy/team-activity" component={TeamActivityPage} />
    <Route path="/energy/decisions" component={DailyDecisionsPage} />
    <Route path="/energy/sites" component={SitesPage} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></Suspense></RouteTransition></DashboardLayout>;
}

function FuelRoutes() {
  return <DashboardLayout area="fuel"><RouteTransition><Suspense fallback={<WorkspacePageLoading label="جارٍ تحميل واجهة الوقود" />}><Switch>
    <Route path="/fuel/role-audit" component={FuelRoleAuditPage} />
    <Route path="/fuel/:tab" component={FuelLandingPage} />
    <Route path="/fuel" component={FuelLandingPage} />
    <Route component={NotFound} />
  </Switch></Suspense></RouteTransition></DashboardLayout>;
}

function Router() {
  return <Suspense fallback={<PlatformLoading />}><Switch>
    <Route path="/"><RouteTransition><SectionPortalPage /></RouteTransition></Route>
    <Route path="/fuel/:rest*" component={FuelRoutes} />
    <Route path="/fuel" component={FuelRoutes} />
    <Route path="/energy/:rest*" component={EnergyRoutes} />
    <Route path="/energy" component={EnergyRoutes} />
    <Route path="/cycles"><Redirect to="/energy/cycles" /></Route>
    <Route path="/operations"><Redirect to="/energy/operations" /></Route>
    <Route path="/reports"><Redirect to="/energy/reports" /></Route>
    <Route path="/analysis"><Redirect to="/energy/analysis" /></Route>
    <Route path="/invoice-test"><Redirect to="/energy/invoice-test" /></Route>
    <Route path="/settings"><Redirect to="/energy/settings" /></Route>
    <Route path="/users"><Redirect to="/energy/users" /></Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch></Suspense>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;

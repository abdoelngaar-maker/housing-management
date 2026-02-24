import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Units from "./pages/Units";
import UnitDetails from "./pages/UnitDetails";
import CheckIn from "./pages/CheckIn";
import BulkCheckIn from "./pages/BulkCheckIn";
import Transfer from "./pages/Transfer";
import Import from "./pages/Import";
import Reports from "./pages/Reports";
import Eviction from "./pages/Eviction";
import Sectors from "./pages/Sectors";
import ImportUnits from "./pages/ImportUnits";
import Notifications from "./pages/Notifications";
import Login from "./pages/Login";
import DetailedReport from "./pages/DetailedReport";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/units" component={Units} />
            <Route path="/units/:id" component={UnitDetails} />
            <Route path="/check-in" component={CheckIn} />
            <Route path="/bulk-check-in" component={BulkCheckIn} />
            <Route path="/transfer" component={Transfer} />
            <Route path="/import" component={Import} />
            <Route path="/import-units" component={ImportUnits} />
            <Route path="/reports" component={Reports} />
            <Route path="/eviction" component={Eviction} />
            <Route path="/detailed-report" component={DetailedReport} />
            <Route path="/sectors" component={Sectors} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

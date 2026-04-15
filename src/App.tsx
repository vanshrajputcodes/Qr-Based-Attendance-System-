import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

const Onboarding = lazy(() => import("./pages/Onboarding"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const SessionView = lazy(() => import("./pages/SessionView"));
const FreePeriodPlanner = lazy(() => import("./pages/FreePeriodPlanner"));
const ManageStudents = lazy(() => import("./pages/ManageStudents"));
const CreateStudents = lazy(() => import("./pages/CreateStudents"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/teacher" element={<TeacherDashboard />} />
              <Route path="/student" element={<StudentDashboard />} />
              <Route path="/session/:sessionId" element={<SessionView />} />
              <Route path="/planner" element={<FreePeriodPlanner />} />
              <Route path="/teacher/students" element={<ManageStudents />} />
              <Route path="/teacher/students/create" element={<CreateStudents />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/student/profile" element={<StudentProfile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Inbox from "./pages/Inbox";
import EmailView from "./pages/EmailView";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PhishingTrap from "./pages/PhishingTrap";
import ScoreVisualization from "./pages/ScoreVisualization";
import InstructorAnalytics from "./pages/InstructorAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
              <Route path="/email/:id" element={<ProtectedRoute><EmailView /></ProtectedRoute>} />
              <Route path="/dashboard-student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/dashboard-admin" element={<ProtectedRoute allowedRoles={['instructor']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/score-visualization" element={<ProtectedRoute><ScoreVisualization /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute allowedRoles={['instructor']}><InstructorAnalytics /></ProtectedRoute>} />
              <Route path="/phishing-trap" element={<PhishingTrap />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

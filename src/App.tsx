import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import NewContent from "./pages/NewContent";
import AnalyzePage from "./pages/Analyze";
import GeneratePage from "./pages/Generate";
import EditorPage from "./pages/Editor";
import LibraryPage from "./pages/Library";
import BrandVoicePage from "./pages/BrandVoice";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/new" element={<ProtectedRoute><NewContent /></ProtectedRoute>} />
            <Route path="/analyze/:id" element={<ProtectedRoute><AnalyzePage /></ProtectedRoute>} />
            <Route path="/generate/:id" element={<ProtectedRoute><GeneratePage /></ProtectedRoute>} />
            <Route path="/editor/:postId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
            <Route path="/brand-voice" element={<ProtectedRoute><BrandVoicePage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

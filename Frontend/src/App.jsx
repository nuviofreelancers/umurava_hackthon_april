import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Job';
import JobForm from './pages/JobForm';
import JobDetail from './pages/JobDetail';
import Candidates from './pages/Candidates';
import Screening from './pages/Screening';
import CandidateCompare from './pages/CandidateCompare';
import JobCsvPreview from './pages/JobCsvPreview';
import CandidateDetail from './pages/CandidateDetail';
import Profile from './pages/Profile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/jobs" replace /> : <Login />
      } />

      {/* Protected — redirect to /login if not authenticated */}
      <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index                                   element={<Navigate to="/jobs" replace />} />
        <Route path="/"              element={<Navigate to="/jobs" replace />} />
        <Route path="/dashboard"     element={<Dashboard />} />
        <Route path="/jobs"          element={<Jobs />} />
        <Route path="/jobs/new"      element={<JobForm />} />
        <Route path="/jobs/csv-preview" element={<JobCsvPreview />} />
        <Route path="/jobs/:id"      element={<JobDetail />} />
        <Route path="/candidates"    element={<Candidates />} />
        <Route path="/screening"     element={<Screening />} />
        <Route path="/compare"       element={<CandidateCompare />} />
        <Route path="/candidates/:id" element={<CandidateDetail />} />
        <Route path="/profile"       element={<Profile />} />
        <Route path="*"              element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <ReduxProvider store={store}>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}

export default App;
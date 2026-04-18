import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/lib/ProtectedRoute';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Job';
import JobForm from './pages/JobForm';
import JobDetail from './pages/JobDetail';
import Candidates from './pages/Candidates';
import Screening from './pages/Screening';
import CandidateCompare from './pages/CandidateCompare';
import JobCsvPreview from './pages/JobCsvPreview';
import CandidateCsvPreview from './pages/CandidateCsvPreview';
import CandidateDetail from './pages/CandidateDetail';
import Profile from './pages/Profile';
import Login from './pages/Login';

function App() {
  return (
    <ReduxProvider store={store}>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/login"    element={<Login />} />

              {/* Protected routes — all nested under ProtectedRoute */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route index                             element={<Navigate to="/jobs" replace />} />
                  <Route path="/"                          element={<Navigate to="/jobs" replace />} />
                  <Route path="/dashboard"                 element={<Dashboard />} />
                  <Route path="/jobs"                      element={<Jobs />} />
                  <Route path="/jobs/new"                  element={<JobForm />} />
                  <Route path="/jobs/csv-preview"          element={<JobCsvPreview />} />
                  <Route path="/candidates/csv-preview"    element={<CandidateCsvPreview />} />
                  <Route path="/jobs/:id"                  element={<JobDetail />} />
                  <Route path="/candidates"                element={<Candidates />} />
                  <Route path="/screening"                 element={<Screening />} />
                  <Route path="/compare"                   element={<CandidateCompare />} />
                  <Route path="/candidates/:id"            element={<CandidateDetail />} />
                  <Route path="/profile"                   element={<Profile />} />
                  <Route path="*"                          element={<PageNotFound />} />
                </Route>
              </Route>
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ReduxProvider>
  );
}

export default App;

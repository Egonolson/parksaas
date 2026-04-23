import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import CustomerLayout from './components/CustomerLayout'
import AdminLayout from './components/AdminLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Locations from './pages/Locations'
import Spots from './pages/Spots'
import Contracts from './pages/Contracts'
import Payments from './pages/Payments'
import Settings from './pages/Settings'
import PublicBooking from './pages/PublicBooking'
import CustomerLogin from './pages/CustomerLogin'
import CustomerRegister from './pages/CustomerRegister'
import CustomerDashboard from './pages/CustomerDashboard'
import CustomerProfile from './pages/CustomerProfile'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import Onboarding from './pages/Onboarding'
import BookingEmbed from './pages/BookingEmbed'
import AGB from './pages/legal/AGB'
import Datenschutz from './pages/legal/Datenschutz'
import Impressum from './pages/legal/Impressum'
import AVV from './pages/legal/AVV'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function ProtectedCustomerRoute({ children }) {
  const { isCustomerAuthenticated } = useAuth()
  if (!isCustomerAuthenticated) {
    return <Navigate to="/kunde/login" replace />
  }
  return children
}

function ProtectedAdminRoute({ children }) {
  const { isAdminAuthenticated } = useAuth()
  if (!isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

function OnboardingRedirect({ children }) {
  const { isAuthenticated, operator } = useAuth()
  if (isAuthenticated && operator && operator.onboarding_completed === false) {
    return <Navigate to="/onboarding" replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/park/:slug" element={<PublicBooking />} />

      {/* Legal pages (public) */}
      <Route path="/agb" element={<AGB />} />
      <Route path="/datenschutz" element={<Datenschutz />} />
      <Route path="/impressum" element={<Impressum />} />
      <Route path="/avv" element={<AVV />} />

      {/* Embed page (public, no layout) */}
      <Route path="/embed/:locationId" element={<BookingEmbed />} />

      {/* Onboarding (protected, operator) */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <OnboardingRedirect>
              <Layout>
                <Dashboard />
              </Layout>
            </OnboardingRedirect>
          </ProtectedRoute>
        }
      />
      <Route
        path="/locations"
        element={
          <ProtectedRoute>
            <Layout>
              <Locations />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/spots"
        element={
          <ProtectedRoute>
            <Layout>
              <Spots />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contracts"
        element={
          <ProtectedRoute>
            <Layout>
              <Contracts />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Layout>
              <Payments />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Customer Portal Routes */}
      <Route path="/kunde/login" element={<CustomerLogin />} />
      <Route path="/kunde/registrieren" element={<CustomerRegister />} />
      <Route
        path="/kunde/dashboard"
        element={
          <ProtectedCustomerRoute>
            <CustomerLayout>
              <CustomerDashboard />
            </CustomerLayout>
          </ProtectedCustomerRoute>
        }
      />
      <Route
        path="/kunde/profil"
        element={
          <ProtectedCustomerRoute>
            <CustomerLayout>
              <CustomerProfile />
            </CustomerLayout>
          </ProtectedCustomerRoute>
        }
      />

      {/* Admin Portal Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedAdminRoute>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </ProtectedAdminRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

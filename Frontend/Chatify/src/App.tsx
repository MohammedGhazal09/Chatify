import './App.css'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/protectedRoute'
import PublicRoute from './components/publicRoute'
import LoadingSpinner from './components/loadingSpinner'
import ErrorBoundary from './components/ErrorBoundary'
import QueueIndicator from './components/QueueIndicator'
import { ToastProvider } from './components/Toast'
import { useAuthStore } from './store/authstore'
import { useAuthInit } from './hooks/useAuthQuery'

const Chat = lazy(() => import('./pages/chat/chat'));
const Signup = lazy(() => import('./pages/signup/signup'));
const Login = lazy(() => import('./pages/login/login'));
const ForgotPassword = lazy(() => import('./pages/forgotPassword/forgotPassword'));
const SetupUsername = lazy(() => import('./pages/setupUsername/SetupUsername'));
const AdminHub = lazy(() => import('./pages/admin/AdminHub'));
const AdminModeration = lazy(() => import('./pages/admin/AdminModeration'));
const AdminDeliveryHealth = lazy(() => import('./pages/admin/AdminDeliveryHealth'));
const AdminPrivacyOperations = lazy(() => import('./pages/admin/AdminPrivacyOperations'));
const AdminIntegrations = lazy(() => import('./pages/admin/AdminIntegrations'));
const InviteJoin = lazy(() => import('./pages/invite/InviteJoin'));

function App() {
  useAuthInit();
  const isLoading = useAuthStore((state) => state.isLoading);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner showColdStartNotice={false} />}>
            <Routes>
              <Route path='/' element={<ProtectedRoute><Chat/></ProtectedRoute>}></Route>
              <Route path='/invite/:token' element={<ProtectedRoute><InviteJoin/></ProtectedRoute>}></Route>
              <Route path='/admin' element={<ProtectedRoute><AdminHub/></ProtectedRoute>}></Route>
              <Route path='/admin/moderation' element={<ProtectedRoute><AdminModeration/></ProtectedRoute>}></Route>
              <Route path='/admin/delivery-health' element={<ProtectedRoute><AdminDeliveryHealth/></ProtectedRoute>}></Route>
              <Route path='/admin/privacy-operations' element={<ProtectedRoute><AdminPrivacyOperations/></ProtectedRoute>}></Route>
              <Route path='/admin/integrations' element={<ProtectedRoute><AdminIntegrations/></ProtectedRoute>}></Route>
              <Route path='/setup-username' element={<ProtectedRoute requireUsername={false}><SetupUsername/></ProtectedRoute>}></Route>
              <Route path='/signup' element={<PublicRoute><Signup/></PublicRoute>}></Route>
              <Route path='/login' element={<PublicRoute><Login/></PublicRoute>}></Route>
              <Route path='/forgot-password' element={<PublicRoute><ForgotPassword/></PublicRoute>}></Route>
            </Routes>
          </Suspense>
            <QueueIndicator />
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App

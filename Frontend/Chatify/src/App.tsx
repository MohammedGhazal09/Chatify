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
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path='/' element={<ProtectedRoute><Chat/></ProtectedRoute>}></Route>
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

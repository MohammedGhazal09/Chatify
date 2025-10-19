import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Chat from './pages/chat/chat'
import Signup from './pages/signup/signup'
import Login from './pages/login/login'
import ProtectedRoute from './components/protectedRoute'
import PublicRoute from './components/publicRoute'
import LoadingSpinner from './components/loadingSpinner'
import ForgotPassword from './pages/forgotPassword/forgotPassword'
import { useAuthStore } from './store/authstore'
import { useAuthInit } from './hooks/useAuthQuery'

function App() {
  useAuthInit();
  const isLoading = useAuthStore((state) => state.isLoading);
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <BrowserRouter>
        <Routes>
          <Route path='/' element={<ProtectedRoute><Chat/></ProtectedRoute>}></Route>
          <Route path='/signup' element={<PublicRoute><Signup/></PublicRoute>}></Route>
          <Route path='/login' element={<PublicRoute><Login/></PublicRoute>}></Route>
          <Route path='/forgot-password' element={<PublicRoute><ForgotPassword/></PublicRoute>}></Route>
        </Routes>
    </BrowserRouter>
  )
}

export default App

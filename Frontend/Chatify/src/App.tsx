import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Chat from './pages/chat/chat'
import Signup from './pages/signup/signup'
import Login from './pages/login/login'
import ProtectedRoute from './components/protectedRoute'
import PublicRoute from './components/publicRoute'
import LoadingSpinner from './components/loadingSpinner'
import useAuthStore from './store/authStor'
import { useEffect } from 'react'

function App() {
  const { initializeAuth, isLoading, isOAuthLoading } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  if (isLoading || isOAuthLoading) {
    return <LoadingSpinner/>
  }

  return (
    <BrowserRouter>
        <Routes>
          <Route path='/' element={<ProtectedRoute><Chat/></ProtectedRoute>}></Route>
          <Route path='/signup' element={<PublicRoute><Signup/></PublicRoute>}></Route>
          <Route path='/login' element={<PublicRoute><Login/></PublicRoute>}></Route>
        </Routes>
    </BrowserRouter>
  )
}

export default App

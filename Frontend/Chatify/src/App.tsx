import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import axiosInstance from './api/index'
import Home from './pages/home/home'
import Signup from './pages/signup/signup'
import Login from './pages/login/login'
import AuthProvider from './contexts/authContext'
import ProtectedRoute from './components/protectedRoute'
import PublicRoute from './components/publicRoute'

function App() {
  useEffect(() => {
    axiosInstance.get('/api/csrf-token').catch(() => {
      console.error('Failed to fetch CSRF token')
    })
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path='/' element={<ProtectedRoute><Home/></ProtectedRoute>}></Route>
          <Route path='/signup' element={<PublicRoute><Signup/></PublicRoute>}></Route>
          <Route path='/login' element={<PublicRoute><Login/></PublicRoute>}></Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

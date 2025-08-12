import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import axiosInstance from './api/index'
import Home from './pages/home/home'
import Signup from './pages/signup/signup'
import Login from './pages/login/login'

function App() {
  useEffect(() => {
    axiosInstance.get('/api/csrf-token').catch(() => {
      console.error('Failed to fetch CSRF token')
    })
  }, [])

  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Home/>}></Route>
        <Route path='/signup' element={<Signup/>}></Route>
        <Route path='/login' element={<Login/>}></Route>
      </Routes>
    </BrowserRouter>
    </>
  )
}

export default App

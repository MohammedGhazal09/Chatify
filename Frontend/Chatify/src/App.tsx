import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Chat from './pages/chat/chat'
import Signup from './pages/signup/signup'
import Login from './pages/login/login'
import AuthProvider from './contexts/authContext'
import ProtectedRoute from './components/protectedRoute'
import PublicRoute from './components/publicRoute'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path='/' element={<ProtectedRoute><Chat/></ProtectedRoute>}></Route>
          <Route path='/signup' element={<PublicRoute><Signup/></PublicRoute>}></Route>
          <Route path='/login' element={<PublicRoute><Login/></PublicRoute>}></Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

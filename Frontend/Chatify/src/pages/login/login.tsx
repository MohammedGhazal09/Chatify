import React, { useEffect, useState} from 'react'
import ChatifyIcon from '../../components/chatifyIcon'
import AccountsButton from '../../components/accountsButton'
import axios from 'axios'
import axiosInstance from '../../api/index'
import { login as loginApi } from '../../api/auth'

interface User {
  email: string;
  password: string;
}

 const Login =() => {
  const [user, setUser] = useState<User>({
    email: "",
    password: "",
  })

 useEffect(() => {
   axiosInstance.get('/api/csrf-token').catch(() => {})
 }, [])

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null)
    setLoading(true)
    try {
      await loginApi(user)
      window.location.href = '/'
    } catch (err: unknown) {
      let message = 'Signup failed'
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string }
        message = data?.message ?? message
      } else if (err instanceof Error) {
        message = err.message
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: string = "text-black text-2xl border-black border-2 radius rounded p-2"
  const labelStyle: string = "text-black text-2xl font-bold"

  return (
    <div className='bg-[#d3e2f1] h-screen flex items-center justify-center text-white  '>
      <div className='bg-[#ffffff] p-8 rounded-lg shadow-lg flex flex-col items-center box-'>
        <div className='w-24 h-24 mb-4'>
          <ChatifyIcon />
        </div>
        <h1 className={`${labelStyle} mb-5`}>Login</h1>
        <h3 className={`${labelStyle} mb-5`}>Sign in to your account</h3>
        <form onSubmit={onFormSubmit} className='flex flex-col gap-2 w-full '>
        <label className={labelStyle}>Email</label>
        <input className={`${inputStyle} placeholder:text-[20px]`} onChange={(e) => setUser({...user, email: e.target.value})} type="email" placeholder="n@example.com" />
        <label className={labelStyle}>Password</label>
        <input className={inputStyle} onChange={(e) => setUser({...user, password: e.target.value})} type="password" placeholder="********" />
        {error && <p className='text-red-600 text-xl'>{error}</p>}
        <AccountsButton color="#20b551" text={loading ? 'Logging in...' : 'Login'} disabled={loading} />
        <p className='text-black text-2xl mt-4'>Do not have an account? <a href="/signup" className='text-black underline font-bold'>Signup</a></p>
        </form> 
      </div>
    </div>
  )
}

export default Login
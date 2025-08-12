import React, { useEffect, useState} from 'react'
import axios from 'axios'
import ChatifyIcon from '../../components/chatifyIcon'
import AccountsButton from '../../components/accountsButton'
import axiosInstance from '../../api/index'
import { signup as signupApi } from '../../api/auth'

interface User {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

 const Signup =() => {
  const [user, setUser] = useState<User>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  })

  useEffect(() => {
    axiosInstance.get('/api/csrf-token').catch(() => {})
  }, [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const onFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await signupApi(user)
      setSuccess('Account created successfully. Please log in.')
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
    <div className='bg-[#d3e2f1] h-screen flex items-center justify-center text-white min- my-10 '>
      <div className='bg-[#ffffff] p-8 rounded-lg shadow-lg flex flex-col items-center box-'>
        <div className='w-24 h-24 mb-4'>
          <ChatifyIcon />
        </div>
        <h1 className={`${labelStyle} mb-5`}>Signup</h1>
        <h3 className={`${labelStyle} mb-5`}>Get started for free</h3>
        <form onSubmit={onFormSubmit} className='flex flex-col gap-2 w-full '>
        <div className='flex flex-col gap-y-2'>
        <label className={labelStyle}>First Name</label>
        <input className={inputStyle} onChange={(e) => setUser({...user, firstName: e.target.value})} type="text" placeholder="Ahmed" />
        <label className={labelStyle}>Last Name</label>
        <input className={inputStyle} onChange={(e) => setUser({...user, lastName: e.target.value})} type="text" placeholder="Musa" />
        </div>
        <label className={labelStyle}>Email</label>
        <input className={`${inputStyle} placeholder:text-[20px]`} onChange={(e) => setUser({...user, email: e.target.value})} type="email" placeholder="n@example.com" />
        <label className={labelStyle}>Password</label>
        <input className={inputStyle} onChange={(e) => setUser({...user, password: e.target.value})} type="password" placeholder="********" />
        {error && <p className='text-red-600 text-xl'>{error}</p>}
        {success && <p className='text-green-600 text-xl'>{success}</p>}
        <AccountsButton color="#20b551" text={loading ? 'Creating...' : 'Signup'} disabled={loading} />
        <p className='text-black text-2xl mt-4'>Already have an account? <a href="/login" className='text-black underline font-bold'>Login</a></p>
        </form> 
      </div>
    </div>
  )
}

export default Signup
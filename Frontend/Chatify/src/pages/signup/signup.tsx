import React, { useState} from 'react'
import ChatifyIcon from '../../components/ChatifyIcon'
import AccountsButton from '../../components/accountsButton'

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

  const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        <AccountsButton color="#20b551" text="Signup" />
        <p className='text-black text-2xl mt-4'>Already have an account? <a href="/login" className='text-black underline font-bold'>Login</a></p>
        </form> 
      </div>
    </div>
  )
}

export default Signup
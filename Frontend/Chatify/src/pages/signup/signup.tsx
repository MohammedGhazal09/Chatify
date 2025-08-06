import React, { useState} from 'react'

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
    console.log(user);
  }

  return (
    <div className='bg-gray-950 h-screen flex items-center justify-center text-white'>
      <div className='bg-gray-800 p-8 rounded-lg shadow-lg w-96 flex flex-col items-center'>
        <h1 className='text-2xl font-bold mb-4 mb-10'>Signup</h1>
        <h3 className='text-2xl font-bold mb-4 mb-10'>Get started for free</h3>
        <form onSubmit={onFormSubmit} className='flex flex-col gap-4 w-full '>
        <input className='' onChange={(e) => setUser({...user, firstName: e.target.value})} type="text" placeholder="First Name" />
        <input onChange={(e) => setUser({...user, lastName: e.target.value})} type="text" placeholder="Last Name" />
        <input onChange={(e) => setUser({...user, email: e.target.value})} type="email" placeholder="Email" />
        <input onChange={(e) => setUser({...user, password: e.target.value})} type="password" placeholder="Password" />
        </form> 
      </div>
    </div>
  )
}

export default Signup
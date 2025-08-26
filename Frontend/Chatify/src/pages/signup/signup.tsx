import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import ChatifyIcon from '../../components/chatifyIcon'
import AccountsButton from '../../components/accountsButton'
import { useAuth } from '../../hooks/useAuth'
import { useAuthRedirect } from '../../hooks/useAuthRedirect'
import { signupSchema, type SignupFormData } from '../../utils/validationSchemas'

const Signup = () => {
  const { signup } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    clearErrors
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange'
  })

  useAuthRedirect()

  const onSubmit = async (data: SignupFormData) => {
    clearErrors('root')
    
    try {
      await signup(data)
    } catch (err: unknown) {
      // Handle API errors
      const message = err instanceof Error ? err.message : 'Signup failed'
      setError('root', { 
        type: 'manual', 
        message 
      })
    }
  }

  const inputStyle: string = "text-black text-2xl border-black border-2 rounded p-2 w-full"
  const labelStyle: string = "text-black text-2xl font-bold"
  const errorStyle: string = "text-red-600 text-lg mt-1"

  return (
    <div className='bg-[#d3e2f1] h-screen flex items-center justify-center text-white min- my-10'>
      <div className='bg-[#ffffff] p-8 rounded-lg shadow-lg flex flex-col items-center box-'>
        <div className='w-24 h-24 mb-4'>
          <ChatifyIcon />
        </div>
        <h1 className={`${labelStyle} mb-5`}>Signup</h1>
        <h3 className={`${labelStyle} mb-5`}>Get started for free</h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-2 w-full' style={{ width: '100%' }}>
          <div className='flex flex-col gap-y-2'>
            <div>
              <label className={labelStyle}>First Name</label>
              <input 
                className={`${inputStyle} ${errors.firstName ? 'border-red-500' : ''}`}
                {...register('firstName')}
                type="text" 
                placeholder="Ahmed" 
                disabled={isSubmitting}
              />
              {errors.firstName && (
                <p className={errorStyle}>{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className={labelStyle}>Last Name</label>
              <input 
                className={`${inputStyle} ${errors.lastName ? 'border-red-500' : ''}`}
                {...register('lastName')}
                type="text" 
                placeholder="Musa" 
                disabled={isSubmitting}
              />
              {errors.lastName && (
                <p className={errorStyle}>{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelStyle}>Email</label>
            <input 
              className={`${inputStyle} placeholder:text-[20px] ${errors.email ? 'border-red-500' : ''}`}
              {...register('email')}
              type="email" 
              placeholder="n@example.com" 
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className={errorStyle}>{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className={labelStyle}>Password</label>
            <input 
              className={`${inputStyle} ${errors.password ? 'border-red-500' : ''}`}
              {...register('password')}
              type="password" 
              placeholder="********" 
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className={errorStyle}>{errors.password.message}</p>
            )}
          </div>

          {/* API Error Display */}
          {errors.root && (
            <p className={errorStyle}>{errors.root.message}</p>
          )}

          <AccountsButton 
            color="#20b551" 
            text={isSubmitting ? 'Creating...' : 'Signup'} 
            disabled={isSubmitting}
          />
          
          <p className='text-black text-2xl mt-4'>
            Already have an account? <a href="/login" className='text-black underline font-bold'>Login</a>
          </p>
        </form> 
      </div>
    </div>
  )
}

export default Signup
'use client'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { Wrench } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [msLoading, setMsLoading] = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function handleMicrosoftLogin() {
    setMsLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setMsLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top navy bar */}
      <div className="bg-[#1B2E6B] h-1.5 w-full" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-[#1B2E6B] flex items-center justify-center rounded">
              <span className="text-white font-bold text-xl">F</span>
            </div>
            <span className="text-3xl font-bold tracking-widest text-[#1B2E6B]">FORMENTERA</span>
          </div>
          <p className="text-sm text-gray-400 mt-1 flex items-center justify-center gap-1.5">
            <Wrench size={13} /> Work Order App
          </p>
        </div>

        {/* Login form */}
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Sign in to continue</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@formenteraops.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary mt-2"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={msLoading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            {msLoading ? 'Redirecting…' : 'Sign in with Microsoft'}
          </button>
        </div>
      </div>

      <div className="text-center pb-8 text-xs text-gray-300">
        © {new Date().getFullYear()} Formentera Operations
      </div>
    </div>
  )
}

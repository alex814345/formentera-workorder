'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

interface AuthContextType {
  user: User | null
  session: Session | null
  userEmail: string
  userName: string
  role: string
  assets: string[]
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userEmail: '',
  userName: '',
  role: 'field_user',
  assets: [],
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string>('field_user')
  const [assets, setAssets] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseBrowserClient()

  async function loadEmployeeProfile(email: string) {
    const { data } = await supabase
      .from('employees')
      .select('role, assets')
      .ilike('work_email', email)
      .single()
    if (data) {
      setRole(data.role || 'field_user')
      setAssets(data.assets || [])
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user?.email) {
        loadEmployeeProfile(session.user.email).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user?.email) {
          loadEmployeeProfile(session.user.email).finally(() => setLoading(false))
        } else {
          setRole('field_user')
          setAssets([])
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const userEmail = user?.email ?? ''
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    userEmail.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ||
    ''

  return (
    <AuthContext.Provider value={{ user, session, userEmail, userName, role, assets, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

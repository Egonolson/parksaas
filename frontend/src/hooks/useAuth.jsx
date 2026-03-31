import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [operator, setOperator] = useState(() => {
    try {
      const stored = localStorage.getItem('operator')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isAuthenticated = !!token

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/operators/login', { email, password })
      const { token: newToken, operator: operatorData } = response.data
      localStorage.setItem('token', newToken)
      localStorage.setItem('operator', JSON.stringify(operatorData))
      setToken(newToken)
      setOperator(operatorData)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Anmeldung fehlgeschlagen'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (data) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/operators/register', data)
      const { token: newToken, operator: operatorData } = response.data
      localStorage.setItem('token', newToken)
      localStorage.setItem('operator', JSON.stringify(operatorData))
      setToken(newToken)
      setOperator(operatorData)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Registrierung fehlgeschlagen'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('operator')
    setToken(null)
    setOperator(null)
  }, [])

  const updateOperator = useCallback((data) => {
    const updated = { ...operator, ...data }
    localStorage.setItem('operator', JSON.stringify(updated))
    setOperator(updated)
  }, [operator])

  return (
    <AuthContext.Provider value={{
      operator,
      token,
      isAuthenticated,
      loading,
      error,
      login,
      register,
      logout,
      updateOperator,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default useAuth

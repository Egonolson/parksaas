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
  const [customer, setCustomer] = useState(() => {
    try {
      const stored = localStorage.getItem('customer')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [admin, setAdmin] = useState(() => {
    try {
      const stored = localStorage.getItem('admin')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isAuthenticated=!!token && !!operator
  const isCustomerAuthenticated=!!token && !!customer
  const isCustomer = !!customer && !operator
  const isAdminAuthenticated = !!token && !!admin
  const isAdmin = !!admin && admin?.role === 'platform_admin'

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/login', { email, password })
      const { token: newToken, tenant } = response.data
      const operatorData = { ...tenant, company_name: tenant.name || tenant.company_name || 'Operator' }
      localStorage.setItem('token', newToken)
      localStorage.setItem('operator', JSON.stringify(operatorData))
      localStorage.removeItem('customer')
      setToken(newToken)
      setOperator(operatorData)
      setCustomer(null)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Anmeldung fehlgeschlagen'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  const customerLogin = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/customer/login', { email, password })
      const { token: newToken, customer: customerData } = response.data
      localStorage.setItem('token', newToken)
      localStorage.setItem('customer', JSON.stringify(customerData))
      localStorage.removeItem('operator')
      setToken(newToken)
      setCustomer(customerData)
      setOperator(null)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Anmeldung fehlgeschlagen'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  const customerRegister = useCallback(async (data) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/customer/register', data)
      const { token: newToken, customer: customerData } = response.data
      localStorage.setItem('token', newToken)
      localStorage.setItem('customer', JSON.stringify(customerData))
      localStorage.removeItem('operator')
      setToken(newToken)
      setCustomer(customerData)
      setOperator(null)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Registrierung fehlgeschlagen'
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
      const response = await api.post('/auth/register', data)
      const { token: newToken, tenant } = response.data
      const operatorData = { ...tenant, company_name: tenant.name || tenant.company_name || 'Operator' }
      localStorage.setItem('token', newToken)
      localStorage.setItem('operator', JSON.stringify(operatorData))
      localStorage.removeItem('customer')
      setToken(newToken)
      setOperator(operatorData)
      setCustomer(null)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Registrierung fehlgeschlagen'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  const adminLogin = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.post('/auth/platform/login', { email, password })
      const { token: newToken } = response.data
      const adminData = { email, role: 'platform_admin' }
      localStorage.setItem('token', newToken)
      localStorage.setItem('admin', JSON.stringify(adminData))
      localStorage.removeItem('operator')
      localStorage.removeItem('customer')
      setToken(newToken)
      setAdmin(adminData)
      setOperator(null)
      setCustomer(null)
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Anmeldung fehlgeschlagen'
      setError(message)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  const adminLogout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('admin')
    setToken(null)
    setAdmin(null)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('operator')
    localStorage.removeItem('customer')
    localStorage.removeItem('admin')
    setToken(null)
    setOperator(null)
    setCustomer(null)
    setAdmin(null)
  }, [])

  const updateOperator = useCallback((data) => {
    const updated = { ...operator, ...data }
    localStorage.setItem('operator', JSON.stringify(updated))
    setOperator(updated)
  }, [operator])

  const updateCustomer = useCallback((data) => {
    const updated = { ...customer, ...data }
    localStorage.setItem('customer', JSON.stringify(updated))
    setCustomer(updated)
  }, [customer])

  return (
    <AuthContext.Provider value={{
      operator,
      customer,
      admin,
      token,
      isAuthenticated,
      isCustomerAuthenticated,
      isCustomer,
      isAdminAuthenticated,
      isAdmin,
      loading,
      error,
      login,
      customerLogin,
      customerRegister,
      register,
      adminLogin,
      adminLogout,
      logout,
      updateOperator,
      updateCustomer,
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

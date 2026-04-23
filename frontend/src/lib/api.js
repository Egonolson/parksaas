import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: add JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401 globally (skip for auth endpoints)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthRequest = url.includes('/auth/')
    if (error.response?.status === 401 && !isAuthRequest) {
      const isAdmin = url.includes('/platform/')
      const isCustomer = !!localStorage.getItem('customer')
      if (isAdmin) {
        localStorage.removeItem('token')
        localStorage.removeItem('admin')
        window.location.href = '/admin/login'
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('operator')
        localStorage.removeItem('customer')
        window.location.href = isCustomer ? '/kunde/login' : '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

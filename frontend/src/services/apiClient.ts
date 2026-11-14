import axios, { AxiosError, type AxiosInstance } from 'axios'
import { getCsrfToken } from '@/services/csrf'

/**
 * Centralized Axios client for the PHP REST API.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://vehicocrm.gdaisolutions.com/api'
const timeout = Number(import.meta.env.VITE_API_TIMEOUT) || 15000

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client': 'gdai-cab-crm-web',
  },
})

apiClient.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method && !['get', 'head', 'options'].includes(method) && config.url !== '/auth/login.php') {
    const csrfToken = getCsrfToken()
    if (csrfToken) config.headers.set('X-CSRF-Token', csrfToken)
  }
  return config
})

// Response interceptor — normalize errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    let message = 'An unexpected error occurred. Please try again.'
    if (error.response) {
      const status = error.response.status
      const data = error.response.data
      if (status === 401) {
        message = 'You are not authorized. Please sign in again.'
        window.dispatchEvent(new Event('gdai:unauthorized'))
      }
      else if (status === 403) message = 'You do not have permission to perform this action.'
      else if (status === 404) message = 'The requested resource was not found.'
      else if (status === 503 && data?.message) message = data.message
      else if (status >= 500) message = 'Server error. Please try again in a moment.'
      else if (data?.message) message = data.message
    } else if (error.request) {
      message = 'Network error. Please check your connection.'
    }
    return Promise.reject(new Error(message))
  },
)

export default apiClient

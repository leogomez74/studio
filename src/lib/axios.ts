import axios from 'axios';
import { getAuthToken } from './auth';

// 1. Configuración de la URL Base
// Si tu variable de entorno es 'http://localhost:8000/api', le quitamos el '/api'
// porque Sanctum necesita acceder a la raíz para las cookies (/sanctum/csrf-cookie).
const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const baseURL = envUrl.replace(/\/api\/?$/, '');

const api = axios.create({
    baseURL: baseURL, // Quedará como 'http://localhost:8000'
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
    },
    // Permite que las cookies (sesión y CSRF) viajen entre el puerto 3000 y 8000.
    withCredentials: true,
    withXSRFToken: true
});

// Interceptor para agregar el Bearer token a cada request
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores de autenticación (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      console.warn("Sesión expirada o no iniciada.");
    }
    return Promise.reject(error);
  }
);

export default api;
import axios from 'axios';

const API_BASE_URL = 
  import.meta.env.VITE_API_GATEWAY_URL || 
  import.meta.env.VITE_API_URL || 
  'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para inyectar token JWT y normalizar URLs
apiClient.interceptors.request.use((config) => {
  if (config.url) {
    // Si la ruta inicia con /v1/ sin el prefijo /api, normalizarla automáticamente
    if (config.url.startsWith('/v1/')) {
      config.url = `/api${config.url}`;
    }
    // Si la ruta inicia con /productos o /categorias sin el prefijo /api/v1/catalogo, normalizarla automáticamente
    if (config.url.startsWith('/productos')) {
      config.url = `/api/v1/catalogo${config.url}`;
    }
    if (config.url.startsWith('/categorias')) {
      config.url = `/api/v1/catalogo${config.url}`;
    }
    if (config.baseURL?.endsWith('/api') && config.url.startsWith('/api/')) {
      // Normalizar URLs que ya traen prefijo /api si la baseURL ya incluye /api
      config.url = config.url.replace(/^\/api/, '');
    }
  }
  const token = localStorage.getItem('maxiconecta_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Manejo centralizado de respuestas de error
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Si la petición no era de login/registro, advertir de sesión expirada
      const url = error.config?.url || '';
      if (!url.includes('/login') && !url.includes('/registro')) {
        console.warn('Sesión expirada o token no válido. Limpiando almacenamiento.');
        localStorage.removeItem('maxiconecta_token');
        localStorage.removeItem('maxiconecta_refresh_token');
        localStorage.removeItem('maxiconecta_user');
      }
    }
    return Promise.reject(error);
  }
);

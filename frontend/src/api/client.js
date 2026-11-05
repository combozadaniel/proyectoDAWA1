/**
 * Cliente HTTP único. El frontend NUNCA accede a la base de datos: solo consume la API REST.
 */
import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'servigest_token';

export const tokenStorage = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* almacenamiento no disponible */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let alExpirarSesion = () => {};
export function onSesionExpirada(fn) {
  alExpirarSesion = fn;
}

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      alExpirarSesion();
    }
    return Promise.reject(error);
  },
);

/** Extrae un mensaje legible del formato de error de la API. */
export function mensajeError(error) {
  if (!error) return '';
  if (error.response?.data?.error) {
    const { message, details } = error.response.data.error;
    if (Array.isArray(details) && details.length) {
      return `${message}: ${details.map((d) => d.mensaje).join('; ')}`;
    }
    if (details?.motivos) return `${message}: ${details.motivos.join('; ')}`;
    return message;
  }
  if (error.code === 'ECONNABORTED') return 'El servidor tardó demasiado en responder.';
  if (!error.response) return 'No se pudo conectar con el servidor.';
  return 'Ocurrió un error inesperado.';
}

/** Errores de validación por campo, para mostrarlos junto a cada input. */
export function erroresPorCampo(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.campo, d.mensaje]));
}

export default api;

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { mensajeError } from '../api/client';

/**
 * Hook de petición GET con estados de carga, error y datos.
 * Se vuelve a ejecutar cuando cambian `url` o `params` (serializados).
 */
export function useApi(url, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(Boolean(url));
  const clave = JSON.stringify(params ?? {});
  const peticion = useRef(0);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!url) return;
      const id = ++peticion.current;
      if (!silencioso) setCargando(true);
      setError('');
      try {
        const r = await api.get(url, { params: JSON.parse(clave) });
        if (id === peticion.current) setData(r.data);
      } catch (e) {
        if (id === peticion.current) setError(mensajeError(e));
      } finally {
        if (id === peticion.current) setCargando(false);
      }
    },
    [url, clave],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { data, error, cargando, recargar: cargar, setData };
}

/** Hook para operaciones de escritura (POST/PUT/PATCH/DELETE) con estado de envío. */
export function useMutacion() {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const ejecutar = useCallback(async (fn) => {
    setEnviando(true);
    setError('');
    try {
      return await fn(api);
    } catch (e) {
      setError(mensajeError(e));
      throw e;
    } finally {
      setEnviando(false);
    }
  }, []);

  return { ejecutar, enviando, error, setError };
}

export function useDebounce(valor, ms = 400) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { onSesionExpirada, tokenStorage } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(() => tokenStorage.get());
  const [cargando, setCargando] = useState(true);

  const limpiar = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    setUsuario(null);
  }, []);

  // Al cargar la app se valida el token guardado contra el backend.
  useEffect(() => {
    onSesionExpirada(limpiar);
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => setUsuario(r.data))
      .catch(limpiar)
      .finally(() => setCargando(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStorage.set(data.token);
    setToken(data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      limpiar();
    }
  }, [limpiar]);

  const tieneRol = useCallback((...roles) => !!usuario && roles.includes(usuario.rol), [usuario]);

  const value = useMemo(
    () => ({ usuario, token, cargando, login, logout, tieneRol }),
    [usuario, token, cargando, login, logout, tieneRol],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

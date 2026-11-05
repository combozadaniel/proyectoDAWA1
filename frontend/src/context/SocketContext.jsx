/**
 * Conexión Socket.IO autenticada. Expone:
 *  - noLeidas: contador de notificaciones no leídas (se actualiza sin recargar)
 *  - ultimaNotificacion: para mostrar un toast
 *  - suscribir(evento, fn): para que las páginas reaccionen a "solicitud:actualizada"
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import api, { API_URL } from '../api/client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, usuario } = useAuth();
  const socketRef = useRef(null);
  const [conectado, setConectado] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [ultimaNotificacion, setUltimaNotificacion] = useState(null);

  const refrescarContador = useCallback(() => {
    api
      .get('/notificaciones', { params: { limit: 1 } })
      .then((r) => setNoLeidas(r.data.noLeidas))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || !usuario) return undefined;
    refrescarContador();
    const socket = io(API_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => setConectado(true));
    socket.on('disconnect', () => setConectado(false));
    socket.on('notificacion', (n) => {
      setNoLeidas((c) => c + 1);
      setUltimaNotificacion(n);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConectado(false);
    };
  }, [token, usuario, refrescarContador]);

  const suscribir = useCallback((evento, fn) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on(evento, fn);
    return () => s.off(evento, fn);
  }, []);

  return (
    <SocketContext.Provider
      value={{ conectado, noLeidas, setNoLeidas, refrescarContador, ultimaNotificacion, suscribir }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Ejecuta `fn` cada vez que el servidor informa un cambio en alguna solicitud visible. */
export function useSolicitudesEnVivo(fn) {
  const { suscribir, conectado } = useSocket();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => suscribir('solicitud:actualizada', (p) => ref.current(p)), [suscribir, conectado]);
}

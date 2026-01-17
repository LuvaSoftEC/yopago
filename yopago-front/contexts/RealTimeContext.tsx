import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Client, type IFrame, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { API_CONFIG } from '../services/config';
import { useAuth } from './AuthContext';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type RealTimeEvent = {
  type?: string;
  payload?: unknown;
  timestamp?: string;
  groupId?: number;
  memberId?: number;
  [key: string]: unknown;
};

type RealTimeCallback = (event: RealTimeEvent, rawMessage: IMessage) => void;

type SubscriptionDescriptor = {
  id: string;
  destination: string;
  callback: RealTimeCallback;
  headers?: Record<string, string>;
};

type ActiveSubscription = {
  descriptor: SubscriptionDescriptor;
  subscription: StompSubscription;
};

interface RealTimeContextValue {
  status: ConnectionStatus;
  lastError: string | null;
  subscribeToGroupEvents: (groupId: number, callback: RealTimeCallback) => () => void;
  subscribeToUserEvents: (memberId: number, callback: RealTimeCallback) => () => void;
  forceReconnect: () => Promise<void>;
}

const RealTimeContext = createContext<RealTimeContextValue | undefined>(undefined);

const generateSubscriptionId = (destination: string) => {
  const randomSegment = Math.random().toString(16).slice(2, 10);
  return `${destination}::${Date.now()}::${randomSegment}`;
};

const parseMessageBody = (message: IMessage): RealTimeEvent => {
  if (!message.body) {
    return { type: undefined };
  }

  try {
    const parsed = JSON.parse(message.body);
    if (parsed && typeof parsed === 'object') {
      return parsed as RealTimeEvent;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[RealTime] No se pudo parsear el mensaje recibido', error);
    }
  }

  return {
    type: message.headers?.['event-type'] ?? message.headers?.['type'] ?? 'event',
    payload: message.body,
  };
};

interface RealTimeProviderProps {
  children: ReactNode;
}

export const RealTimeProvider: React.FC<RealTimeProviderProps> = ({ children }) => {
  const { isAuthenticated, getAccessToken } = useAuth();

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);
  const connectingRef = useRef(false);
  const desiredSubscriptions = useRef<Map<string, SubscriptionDescriptor>>(new Map());
  const activeSubscriptions = useRef<Map<string, ActiveSubscription>>(new Map());

  const activateSubscription = useCallback((descriptor: SubscriptionDescriptor) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      return;
    }

    if (activeSubscriptions.current.has(descriptor.id)) {
      return;
    }

    const subscription = client.subscribe(
      descriptor.destination,
      (message: IMessage) => {
        const event = parseMessageBody(message);
        try {
          descriptor.callback(event, message);
        } catch (error) {
          console.error('[RealTime] Error procesando callback de suscripción', error);
        }
      },
      descriptor.headers,
    );

    activeSubscriptions.current.set(descriptor.id, { descriptor, subscription });
  }, []);

  const deactivateAllSubscriptions = useCallback(() => {
    activeSubscriptions.current.forEach(({ subscription }) => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        if (__DEV__) {
          console.warn('[RealTime] No se pudo cancelar suscripción activa', error);
        }
      }
    });
    activeSubscriptions.current.clear();
  }, []);

  const connect = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    if (clientRef.current?.connected || connectingRef.current) {
      return;
    }

    connectingRef.current = true;
    setStatus('connecting');
    setLastError(null);

    const client = new Client({
      brokerURL: API_CONFIG.WS_URL,
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      connectionTimeout: 10000,
      forceBinaryWSFrames: true,
      logRawCommunication: false,
      debug: (message: string) => {
        if (__DEV__) {
          console.log('[RealTime]', message);
        }
      },
    });

    client.beforeConnect = async () => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No hay token de acceso disponible para WebSocket');
      }
      client.connectHeaders = {
        Authorization: `Bearer ${token}`,
      };
    };

    client.onConnect = () => {
      connectingRef.current = false;
      setStatus('connected');
      setLastError(null);

      desiredSubscriptions.current.forEach((descriptor) => {
        activateSubscription(descriptor);
      });
    };

    client.onDisconnect = () => {
      setStatus('disconnected');
      connectingRef.current = false;
      deactivateAllSubscriptions();
    };

    client.onStompError = (frame: IFrame) => {
      const message = frame.headers?.message || 'Error STOMP desconocido';
      console.error('[RealTime] Error STOMP', message, frame.body);
      setLastError(message);
      setStatus('error');
    };

    client.onWebSocketClose = (event: CloseEvent) => {
      if (!event.wasClean) {
        setLastError(`Conexión cerrada inesperadamente (${event.code})`);
      }
      if (isAuthenticated) {
        setStatus('disconnected');
      }
      deactivateAllSubscriptions();
      connectingRef.current = false;
    };

    client.onWebSocketError = (event: Event) => {
      console.error('[RealTime] Error en WebSocket', event);
      setLastError('Error en la conexión de WebSocket');
      setStatus('error');
    };

    clientRef.current = client;
    client.activate();
  }, [activateSubscription, deactivateAllSubscriptions, getAccessToken, isAuthenticated]);

  const disconnect = useCallback(
    async (clearDesired: boolean) => {
      connectingRef.current = false;
      deactivateAllSubscriptions();
      if (clearDesired) {
        desiredSubscriptions.current.clear();
      }

      const client = clientRef.current;
      clientRef.current = null;

      if (client) {
        try {
          await client.deactivate();
        } catch (error) {
          if (__DEV__) {
            console.warn('[RealTime] Error al desconectar cliente STOMP', error);
          }
        }
      }

      setStatus('disconnected');
    },
    [deactivateAllSubscriptions],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      void disconnect(true);
      return;
    }

    void connect();

    return () => {
      void disconnect(false);
    };
  }, [connect, disconnect, isAuthenticated]);

  const subscribe = useCallback(
    (destination: string, callback: RealTimeCallback, headers?: Record<string, string>) => {
      if (!destination || typeof callback !== 'function') {
        return () => undefined;
      }

      const descriptor: SubscriptionDescriptor = {
        id: generateSubscriptionId(destination),
        destination,
        callback,
        headers,
      };

      desiredSubscriptions.current.set(descriptor.id, descriptor);

      if (clientRef.current?.connected) {
        activateSubscription(descriptor);
      } else if (isAuthenticated) {
        void connect();
      }

      return () => {
        desiredSubscriptions.current.delete(descriptor.id);
        const active = activeSubscriptions.current.get(descriptor.id);
        if (active) {
          try {
            active.subscription.unsubscribe();
          } catch (error) {
            if (__DEV__) {
              console.warn('[RealTime] Error al cancelar suscripción', error);
            }
          }
          activeSubscriptions.current.delete(descriptor.id);
        }
      };
    },
    [activateSubscription, connect, isAuthenticated],
  );

  const subscribeToGroupEvents = useCallback(
    (groupId: number, callback: RealTimeCallback) => {
      if (!Number.isFinite(groupId) || groupId <= 0) {
        return () => undefined;
      }
      const destination = `/topic/groups/${groupId}`;
      return subscribe(destination, callback);
    },
    [subscribe],
  );

  const subscribeToUserEvents = useCallback(
    (memberId: number, callback: RealTimeCallback) => {
      if (!Number.isFinite(memberId) || memberId <= 0) {
        return () => undefined;
      }
      const destination = `/topic/users/${memberId}/events`;
      return subscribe(destination, callback);
    },
    [subscribe],
  );

  const forceReconnect = useCallback(async () => {
    await disconnect(false);
    if (isAuthenticated) {
      await connect();
    }
  }, [connect, disconnect, isAuthenticated]);

  const value = useMemo<RealTimeContextValue>(
    () => ({
      status,
      lastError,
      subscribeToGroupEvents,
      subscribeToUserEvents,
      forceReconnect,
    }),
    [forceReconnect, lastError, status, subscribeToGroupEvents, subscribeToUserEvents],
  );

  return <RealTimeContext.Provider value={value}>{children}</RealTimeContext.Provider>;
};

export const useRealTime = () => {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime debe usarse dentro de un RealTimeProvider');
  }
  return context;
};

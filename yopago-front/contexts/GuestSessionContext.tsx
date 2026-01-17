import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { guestService } from '@/services/guestService';
import { GuestAccessResponse } from '@/services/types';

interface GuestSessionState {
  memberId: number;
  groupId: number;
  guestName: string;
  groupName?: string;
  groupDescription?: string;
  shareCode?: string;
  email?: string;
  isGuest: boolean;
}

interface GuestSessionContextValue {
  session: GuestSessionState | null;
  loading: boolean;
  error: string | null;
  redeemInvitation: (token: string, payload: { guestName: string; email: string }) => Promise<GuestAccessResponse>;
  accessWithCode: (payload: { groupCode: string; guestName: string; email: string; phoneNumber?: string }) => Promise<GuestAccessResponse>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  logoutGuest: () => Promise<void>;
  isGuestAuthenticated: boolean;
}

const GuestSessionContext = createContext<GuestSessionContextValue | undefined>(undefined);

interface Props {
  children: React.ReactNode;
}

export const GuestSessionProvider: React.FC<Props> = ({ children }) => {
  const [session, setSession] = useState<GuestSessionState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const applyGuestResponse = useCallback((response: GuestAccessResponse) => {
    if (!response?.success) {
      setSession(null);
      return;
    }

    const { group, member } = response;
    if (!group?.id || !member?.id) {
      setSession(null);
      return;
    }

    setSession({
      groupId: group.id,
      memberId: member.id,
      guestName: member.name,
      groupName: group.name,
      groupDescription: group.description,
      shareCode: group.shareCode,
      email: member.email,
      isGuest: member.isGuest ?? true,
    });
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // TODO: Comentado temporalmente para debugging
      // const info = await guestService.getSessionInfo();
      const info = null;
      if (info?.success && info.isGuest && info.groupId && info.memberId) {
        const memberName = info.guestName || info.member?.name || 'Invitado';
        const groupInfo = info.group;
        setSession({
          groupId: info.groupId,
          memberId: info.memberId,
          guestName: memberName,
          groupName: groupInfo?.name,
          groupDescription: groupInfo?.description,
          shareCode: groupInfo?.shareCode,
          email: info.member?.email,
          isGuest: true,
        });
      } else {
        // TODO: Sesión de invitado deshabilitada temporalmente
        setSession(null);
      }
    } catch (err) {
      console.warn('[GuestSession] refresh error', err);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const redeemInvitation = useCallback(
    async (token: string, payload: { guestName: string; email: string }) => {
      try {
        setLoading(true);
        setError(null);
        const response = await guestService.redeemInvitation(token, payload);
        applyGuestResponse(response);
        Alert.alert('Invitación aceptada', response.message || 'Bienvenido al grupo');
        return response;
      } catch (err: any) {
        console.error('[GuestSession] redeem error', err);
        const message = err?.message || 'No se pudo validar la invitación';
        setError(message);
        Alert.alert('Error', message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applyGuestResponse],
  );

  const accessWithCode = useCallback(
    async (payload: { groupCode: string; guestName: string; email: string; phoneNumber?: string }) => {
      try {
        setLoading(true);
        setError(null);
        const response = await guestService.accessWithCode(payload);
        applyGuestResponse(response);
        Alert.alert('Acceso concedido', response.message || 'Puedes empezar a colaborar');
        return response;
      } catch (err: any) {
        console.error('[GuestSession] code access error', err);
        const message = err?.message || 'No se pudo acceder con el código';
        setError(message);
        Alert.alert('Error', message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [applyGuestResponse],
  );

  const logoutGuest = useCallback(async () => {
    try {
      setLoading(true);
      await guestService.logout();
    } catch (err) {
      console.warn('[GuestSession] logout error', err);
    } finally {
      setSession(null);
      setLoading(false);
    }
  }, []);

  const value = useMemo<GuestSessionContextValue>(
    () => ({
      session,
      loading,
      error,
      redeemInvitation,
      refreshSession,
      accessWithCode,
      clearError: () => setError(null),
      logoutGuest,
      isGuestAuthenticated: Boolean(session),
    }),
    [session, loading, error, redeemInvitation, refreshSession, accessWithCode, logoutGuest],
  );

  return <GuestSessionContext.Provider value={value}>{children}</GuestSessionContext.Provider>;
};

export const useGuestSession = (): GuestSessionContextValue => {
  const context = useContext(GuestSessionContext);
  if (!context) {
    throw new Error('useGuestSession debe usarse dentro de un GuestSessionProvider');
  }
  return context;
};

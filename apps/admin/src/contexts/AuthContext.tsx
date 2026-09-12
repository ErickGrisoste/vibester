import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { listEstablishments, type Establishment } from '../api/establishment';

const TOKEN_KEY = 'vib_token';
const ACCOUNT_ID_KEY = 'vib_account_id';
const AUTH_ID_KEY = 'vib_auth_id';
const ESTABLISHMENT_KEY = 'vib_establishment';

const DEFAULT_ESTABLISHMENT: Establishment = {
  id: 'default-establishment-id',
  name: 'Meu Estabelecimento',
  category: 'Bar & Balada',
  averageRating: 5.0,
  qtdAvaliacoes: 0,
  distribuicao: [0, 0, 0, 0, 0],
  nivelMovimento: 3,
  latitude: -23.55052,
  longitude: -46.633308,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface AuthUser {
  authId: string;
  accountId: string;
  token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  establishment: Establishment | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => Promise<void>;
  logout: () => void;
  setEstablishment: (e: Establishment) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const accountId = localStorage.getItem(ACCOUNT_ID_KEY);
    const authId = localStorage.getItem(AUTH_ID_KEY);
    if (token && accountId && authId) return { token, accountId, authId };
    return null;
  });

  const [establishment, setEstablishmentState] = useState<Establishment | null>(() => {
    const raw = localStorage.getItem(ESTABLISHMENT_KEY);
    if (raw) {
      try { return JSON.parse(raw) as Establishment; } catch { return null; }
    }
    return null;
  });

  const isAuthenticated = !!user;

  const setEstablishment = (e: Establishment) => {
    localStorage.setItem(ESTABLISHMENT_KEY, JSON.stringify(e));
    setEstablishmentState(e);
  };

  useEffect(() => {
    if (isAuthenticated && !establishment) {
      listEstablishments({ limit: 1 })
        .then((res) => {
          const first = res?.data?.[0];
          if (first) {
            setEstablishment(first);
          } else {
            setEstablishment(DEFAULT_ESTABLISHMENT);
          }
        })
        .catch(() => {
          setEstablishment(DEFAULT_ESTABLISHMENT);
        });
    }
  }, [isAuthenticated, establishment]);

  const login = async (u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, u.token);
    localStorage.setItem(ACCOUNT_ID_KEY, u.accountId);
    localStorage.setItem(AUTH_ID_KEY, u.authId);
    setUser(u);

    try {
      const res = await listEstablishments({ limit: 1 });
      const first = res?.data?.[0];
      if (first) {
        setEstablishment(first);
      } else {
        setEstablishment(DEFAULT_ESTABLISHMENT);
      }
    } catch {
      setEstablishment(DEFAULT_ESTABLISHMENT);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_ID_KEY);
    localStorage.removeItem(AUTH_ID_KEY);
    localStorage.removeItem(ESTABLISHMENT_KEY);
    setUser(null);
    setEstablishmentState(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      establishment,
      isAuthenticated,
      login,
      logout,
      setEstablishment,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

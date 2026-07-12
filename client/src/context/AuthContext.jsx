import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('br_token');
    if (!token) { setLoading(false); return; }
    getMe()
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem('br_token'))
      .finally(() => setLoading(false));
  }, []);

  function login(token, user) {
    localStorage.setItem('br_token', token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem('br_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

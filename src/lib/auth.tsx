import React, { createContext, useContext, useState, useCallback } from "react";
import type { User } from "@/lib/mock-data";
import { users } from "@/lib/mock-data";

interface AuthContextType {
  user: User | null;
  login: (role: "admin" | "employee") => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((role: "admin" | "employee") => {
    setUser(role === "admin" ? users[0] : users[1]);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
};

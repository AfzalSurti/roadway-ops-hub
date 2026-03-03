import React, { createContext, useContext, useMemo, useState } from "react";
import { api, authStorage } from "@/lib/api";
import type { ApiUser } from "@/lib/domain";
import { toAvatarUrl } from "@/lib/domain";

type UserWithAvatar = ApiUser & { avatar: string };

interface AuthContextType {
  user: UserWithAvatar | null;
  login: (email: string, password: string) => Promise<UserWithAvatar>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {
    throw new Error("AuthProvider not initialized");
  },
  logout: async () => undefined,
  isAdmin: false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserWithAvatar | null>(() => {
    const stored = authStorage.getUser();
    return stored ? { ...stored, avatar: toAvatarUrl(stored.name) } : null;
  });

  const login = async (email: string, password: string) => {
    const session = await api.login(email, password);
    const nextUser: UserWithAvatar = {
      ...session.user,
      avatar: toAvatarUrl(session.user.name)
    };
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      isAdmin: user?.role === "ADMIN"
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
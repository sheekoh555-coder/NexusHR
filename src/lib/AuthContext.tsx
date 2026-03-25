import React, { createContext, useContext, useState, useEffect } from 'react';

type AuthContextType = {
  user: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for demo session
    const demoUser = localStorage.getItem('nexus_demo_user');
    if (demoUser) {
      setUser(JSON.parse(demoUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 600));

    if (email === 'admin@nexushr.com' && password === 'admin123') {
      const mockUser = {
        id: 'demo-admin-id',
        email: 'admin@nexushr.com',
        user_metadata: { full_name: 'مدير النظام (Demo)' }
      };
      setUser(mockUser);
      localStorage.setItem('nexus_demo_user', JSON.stringify(mockUser));
    } else {
      throw new Error('بيانات الدخول غير صحيحة. استخدم admin@nexushr.com / admin123');
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('nexus_demo_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

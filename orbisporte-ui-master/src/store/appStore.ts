import { create } from 'zustand';

interface AppState {
  activePage: string;
  setActivePage: (page: string) => void;
  
  // User state
  user: {
    user_name?: string;
    email?: string;
    company_name?: string;
  } | null;
  setUser: (user: AppState['user']) => void;
  
  // Sidebar state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Documents
  documents: any[];
  addDocument: (doc: any) => void;
  updateDocument: (id: string, updates: any) => void;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
  
  // Theme
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  
  user: null,
  setUser: (user) => set({ user }),
  
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  documents: [],
  addDocument: (doc) => set((state) => ({ 
    documents: [...state.documents, { ...doc, id: Date.now().toString() }] 
  })),
  updateDocument: (id, updates) => set((state) => ({
    documents: state.documents.map((doc) => 
      doc.id === id ? { ...doc, ...updates } : doc
    )
  })),
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter((doc) => doc.id !== id)
  })),
  clearDocuments: () => set({ documents: [] }),
  
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DocumentRecord } from '../types/document';

interface DocumentState {
  documents: DocumentRecord[];
  addDocument: (doc: DocumentRecord) => void;
  updateDocument: (id: string, updates: Partial<DocumentRecord>) => void;
  deleteDocument: (id: string) => void;
  clearAll: () => void;
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set) => ({
      documents: [],
      addDocument: (doc) =>
        set((state) => ({ documents: [doc, ...state.documents] })),
      updateDocument: (id, updates) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
        })),
      deleteDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
        })),
      clearAll: () => set({ documents: [] }),
    }),
    {
      name: 'aa2000-document-store',
    }
  )
);

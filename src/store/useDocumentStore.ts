import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import type { DocumentRecord } from '../types/document';

interface DocumentState {
  documents: DocumentRecord[];
  fetchDocuments: () => Promise<void>;
  addDocument: (doc: DocumentRecord) => Promise<void>;
  updateDocument: (id: string, updates: Partial<DocumentRecord>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  clearAll: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  fetchDocuments: async () => {
    try {
      const docs = await apiFetch('/documents');
      set({ documents: docs });
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  },
  addDocument: async (doc) => {
    try {
      await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify(doc),
      });
      set((state) => ({ documents: [doc, ...state.documents] }));
    } catch (err) {
      console.error('Failed to add document:', err);
      throw err;
    }
  },
  updateDocument: async (id, updates) => {
    try {
      await apiFetch(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? { ...doc, ...updates } : doc
        ),
      }));
    } catch (err) {
      console.error('Failed to update document:', err);
      throw err;
    }
  },
  deleteDocument: async (id) => {
    try {
      await apiFetch(`/documents/${id}`, {
        method: 'DELETE',
      });
      set((state) => ({
        documents: state.documents.filter((doc) => doc.id !== id),
      }));
    } catch (err) {
      console.error('Failed to delete document:', err);
      throw err;
    }
  },
  clearAll: () => set({ documents: [] }),
}));

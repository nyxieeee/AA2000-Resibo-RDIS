import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import type { DocumentRecord } from '../types/document';

const USE_DOCUMENTS_API = (import.meta.env.VITE_USE_DOCUMENTS_API ?? 'false') === 'true';

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
    if (!USE_DOCUMENTS_API) return;
    try {
      const docs = await apiFetch('/documents');
      set({ documents: docs });
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  },
  addDocument: async (doc) => {
    // Always keep local UI responsive even when no /documents backend exists.
    set((state) => ({ documents: [doc, ...state.documents] }));
    if (!USE_DOCUMENTS_API) return;
    try {
      await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify(doc),
      });
    } catch (err) {
      console.error('Failed to add document:', err);
    }
  },
  updateDocument: async (id, updates) => {
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, ...updates } : doc
      ),
    }));
    if (!USE_DOCUMENTS_API) return;
    try {
      await apiFetch(`/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to update document:', err);
    }
  },
  deleteDocument: async (id) => {
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
    }));
    if (!USE_DOCUMENTS_API) return;
    try {
      await apiFetch(`/documents/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  },
  clearAll: () => set({ documents: [] }),
}));

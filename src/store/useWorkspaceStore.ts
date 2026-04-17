import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace } from '../types';

interface WorkspaceState {
  workspace: Workspace & { expenseCategories: string[] };
  updateWorkspace: (updates: Partial<Workspace & { expenseCategories: string[] }>) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspace: {
        id: 'ws_01',
        name: 'AA2000 Security And Technology',
        birTin: '000-111-222-000',
        birRdo: '043',
        vatRegistered: true,
        expenseCategories: ['Cost of Sales', 'Travel', 'Meals', 'Bank Charges', 'Office Supplies']
      },
      updateWorkspace: (updates) => set((state) => ({ workspace: { ...state.workspace, ...updates }})),
    }),
    {
      name: 'aa2000-workspace-store',
    }
  )
);

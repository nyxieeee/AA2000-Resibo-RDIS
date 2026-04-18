import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useNotificationStore } from '../../store/useNotificationStore';

// ─── Role helpers ─────────────────────────────────────────────────────────────
const EXEC_ROLES = ['CEO', 'President', 'General Manager'] as const;
type ExecRole = typeof EXEC_ROLES[number];
const isExec = (role: string): role is ExecRole => EXEC_ROLES.includes(role as ExecRole);

// All known users in the system (derived from DEMO_CREDENTIALS)
const ALL_USERS = [
  { name: 'CEO', email: 'ceo@aa2000.com.ph', role: 'CEO', status: 'Active' },
  { name: 'President', email: 'president@aa2000.com.ph', role: 'President', status: 'Active' },
  { name: 'General Manager', email: 'gm@aa2000.com.ph', role: 'General Manager', status: 'Active' },
  { name: 'Accountant 1', email: 'accountant1@aa2000.com.ph', role: 'Accountant', status: 'Active' },
  { name: 'Accountant 2', email: 'accountant2@aa2000.com.ph', role: 'Accountant', status: 'Active' },
];

// ─── Shared sub-components ────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-lg font-semibold text-[--text-primary] border-b border-[--border-subtle] pb-2 mb-4">
      {title}
    </h3>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[--text-secondary] mb-1">{label}</label>
      <input
        type="text"
        readOnly
        value={value}
        className="w-full border border-[--border-default] bg-[--bg-raised] rounded-lg py-2 px-3 text-[--text-muted] cursor-not-allowed"
      />
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[--text-secondary] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[--border-default] bg-[--bg-surface] text-[--text-primary] rounded-lg py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="hidden md:flex border-b border-[--border-default] text-sm font-medium text-[--text-secondary] bg-[--bg-raised] overflow-x-auto whitespace-nowrap">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={
            active === tab
              ? 'px-6 py-3 border-b-2 border-blue-600 text-blue-600 bg-[--bg-surface]'
              : 'px-6 py-3 border-b-2 border-transparent hover:text-[--text-primary] hover:bg-[--bg-page] transition'
          }
        >
          {tab}
        </button>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTANT SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
const ACCOUNTANT_TABS = ['Profile', 'BIR Configurations', 'Categories', 'Notifications'] as const;
type AccountantTab = typeof ACCOUNTANT_TABS[number];

function AccountantSettings() {
  const user = useAuthStore((s) => s.user);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [tab, setTab] = useState<AccountantTab>('Profile');

  // Listen for tab changes triggered from the mobile sidebar drawer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as AccountantTab;
      if (ACCOUNTANT_TABS.includes(detail as AccountantTab)) setTab(detail as AccountantTab);
    };
    window.addEventListener('settings-tab-change', handler);
    return () => window.removeEventListener('settings-tab-change', handler);
  }, []);

  // Local state for draft fields
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifInApp, setNotifInApp] = useState(true);
  const [notifReview, setNotifReview] = useState(false);
  const [categories, setCategories] = useState(workspace.expenseCategories);
  const [newCat, setNewCat] = useState('');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [filingFreq, setFilingFreq] = useState('Monthly');
  const [taxRate, setTaxRate] = useState('2');

  const notifySuccess = (title: string) => {
    if (user?.id) {
      addNotification(user.id, {
        title,
        message: 'Your changes have been saved successfully.',
        type: 'success'
      });
    }
  };

  const handleUpdatePassword = () => {
    notifySuccess('Password Updated');
    setPasswords({ current: '', new: '', confirm: '' });
  };

  const handleSaveBIR = () => {
    notifySuccess('BIR Settings Saved');
  };

  const handleSaveCategories = () => {
    updateWorkspace({ expenseCategories: categories });
    notifySuccess('Categories Updated');
  };

  const handleSavePreferences = () => {
    notifySuccess('Notification Preferences Saved');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Settings</h1>
        <p className="text-[--text-muted] mt-1">
          Manage your profile, BIR configuration, and accounting preferences.
        </p>
      </div>

      <div className="bg-[--bg-surface] border border-[--border-default] rounded-xl overflow-hidden shadow-sm">
        <TabBar
          tabs={[...ACCOUNTANT_TABS]}
          active={tab}
          onChange={(t) => setTab(t as AccountantTab)}
        />

        <div className="p-8 space-y-8">
          {tab === 'Profile' && (
            <>
              <section>
                <SectionHeader title="Your Profile" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ReadOnlyField label="First Name" value={user?.firstName ?? ''} />
                  <ReadOnlyField label="Last Name" value={user?.lastName ?? ''} />
                  <ReadOnlyField label="Email" value={user?.email ?? ''} />
                  <ReadOnlyField label="Role" value={user?.role ?? ''} />
                </div>
              </section>

              <section>
                <SectionHeader title="Change Password" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <EditableField label="Current Password" value={passwords.current} onChange={(v) => setPasswords(p => ({ ...p, current: v }))} type="password" />
                  <EditableField label="New Password" value={passwords.new} onChange={(v) => setPasswords(p => ({ ...p, new: v }))} type="password" />
                  <EditableField label="Confirm New Password" value={passwords.confirm} onChange={(v) => setPasswords(p => ({ ...p, confirm: v }))} type="password" />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleUpdatePassword}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm"
                  >
                    Update Password
                  </button>
                </div>
              </section>

            </>
          )}

          {tab === 'BIR Configurations' && (
            <>
              <section>
                <SectionHeader title="BIR Details" />
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-5">
                  BIR configuration changes affect filings. Contact your supervisor before editing.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <EditableField
                    label="Tax Identification Number (TIN)"
                    value={workspace.birTin}
                    onChange={(v) => updateWorkspace({ birTin: v })}
                  />
                  <EditableField
                    label="Revenue District Office (RDO)"
                    value={workspace.birRdo}
                    onChange={(v) => updateWorkspace({ birRdo: v })}
                  />
                  <div className="flex items-end pb-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={workspace.vatRegistered}
                        onChange={(e) => updateWorkspace({ vatRegistered: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-[--border-default] rounded"
                      />
                      <span className="text-sm font-medium text-[--text-secondary]">VAT Registered</span>
                    </label>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title="Filing Preferences" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[--text-secondary] mb-1">
                      Default Filing Frequency
                    </label>
                    <select
                      value={filingFreq}
                      onChange={(e) => setFilingFreq(e.target.value)}
                      className="w-full border border-[--border-default] rounded-lg py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[--bg-surface] text-[--text-primary]"
                    >
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Annually</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--text-secondary] mb-1">
                      Withholding Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="w-full border border-[--border-default] bg-[--bg-surface] text-[--text-primary] rounded-lg py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveBIR}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm"
                >
                  Save BIR Settings
                </button>
              </div>
            </>
          )}

          {tab === 'Categories' && (
            <section>
              <SectionHeader title="Expense Categories" />
              <p className="text-sm text-[--text-muted] mb-5">
                Manage the expense categories used when classifying scanned documents.
              </p>
              <ul className="divide-y divide-[--border-subtle] border border-[--border-default] rounded-lg overflow-hidden mb-5">
                {categories.map((cat, i) => (
                  <li key={cat} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50">
                    <span className="text-sm text-[--text-secondary]">{cat}</span>
                    <button
                      onClick={() => setCategories((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Add new category…"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCat.trim()) {
                      setCategories((prev) => [...prev, newCat.trim()]);
                      setNewCat('');
                    }
                  }}
                  className="flex-1 border border-[--border-default] bg-[--bg-surface] text-[--text-primary] rounded-lg py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  onClick={() => {
                    if (newCat.trim()) {
                      setCategories((prev) => [...prev, newCat.trim()]);
                      setNewCat('');
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm"
                >
                  Add
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveCategories}
                  className="bg-slate-800 text-white px-5 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-900 transition text-sm"
                >
                  Save Categories
                </button>
              </div>
            </section>
          )}

          {tab === 'Notifications' && (
            <section>
              <SectionHeader title="Notification Preferences" />
              <p className="text-sm text-[--text-muted] mb-6">
                Control how RDIS notifies you about documents that need your attention.
              </p>
              <div className="space-y-4">
                {[
                  {
                    label: 'Email Notifications',
                    desc: 'Receive a daily digest of pending review items to your email.',
                    value: notifEmail,
                    set: setNotifEmail,
                  },
                  {
                    label: 'In-App Notifications',
                    desc: 'Show badge counts and alerts inside the RDIS app.',
                    value: notifInApp,
                    set: setNotifInApp,
                  },
                  {
                    label: 'Review Reminders',
                    desc: 'Send reminders for documents stuck in "For Review" for more than 48 hours.',
                    value: notifReview,
                    set: setNotifReview,
                  },
                ].map(({ label, desc, value, set }) => (
                  <div key={label} className="flex items-center justify-between p-4 border border-[--border-default] rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-[--text-primary]">{label}</p>
                      <p className="text-xs text-[--text-muted] mt-0.5">{desc}</p>
                    </div>
                    <button
                      onClick={() => set((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-blue-600' : 'bg-[--bg-raised]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm"
                >
                  Save Preferences
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
const EXEC_TABS = ['General', 'Organization', 'Access & Roles', 'Data & Privacy'] as const;
type ExecTab = typeof EXEC_TABS[number];

function ExecutiveSettings() {
  const user = useAuthStore((s) => s.user);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const documents = useDocumentStore((s) => s.documents);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [tab, setTab] = useState<ExecTab>('General');

  // Listen for tab changes triggered from the mobile sidebar drawer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ExecTab;
      if (EXEC_TABS.includes(detail as ExecTab)) setTab(detail as ExecTab);
    };
    window.addEventListener('settings-tab-change', handler);
    return () => window.removeEventListener('settings-tab-change', handler);
  }, []);

  // Local state for draft fields
  const [dataRetention, setDataRetention] = useState('12');
  const [auditLog, setAuditLog] = useState(true);
  const [exportApproval, setExportApproval] = useState(true);
  const [companyWebsite, setCompanyWebsite] = useState('https://aa2000.com.ph');
  const [industry, setIndustry] = useState('Real Estate');
  const [fiscalYear, setFiscalYear] = useState('December 31');

  const notifySuccess = (title: string) => {
    if (user?.id) {
      addNotification(user.id, {
        title,
        message: 'Workspace changes have been applied.',
        type: 'success'
      });
    }
  };

  const handleSaveGeneral = () => notifySuccess('General Settings Saved');
  const handleSaveOrganization = () => notifySuccess('Organization Settings Saved');
  const handleSaveGovernance = () => notifySuccess('Governance Settings Saved');

  // ── Real workspace stats ──────────────────────────────────────────────────
  const workspaceStats = useMemo(() => {
    const activeUsers = ALL_USERS.length;

    // Documents uploaded this calendar month
    const now = new Date();
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const docsThisMonth = documents.filter(d => d.date.startsWith(thisMonthPrefix)).length;

    // Rough storage estimate: average ~200KB per document (receipt/invoice image + extracted JSON)
    const estimatedBytes = documents.length * 200 * 1024;
    let storageLabel: string;
    if (estimatedBytes < 1024 * 1024) {
      storageLabel = `${(estimatedBytes / 1024).toFixed(0)} KB`;
    } else if (estimatedBytes < 1024 * 1024 * 1024) {
      storageLabel = `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      storageLabel = `${(estimatedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    return { activeUsers, docsThisMonth, storageLabel };
  }, [documents]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Settings</h1>
        <p className="text-[--text-muted] mt-1">
          Manage workspace configuration, team access, and compliance settings.
        </p>
      </div>

      {/* Live workspace stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Users', value: String(workspaceStats.activeUsers) },
          { label: 'Documents This Month', value: String(workspaceStats.docsThisMonth) },
          { label: 'Workspace Storage Used', value: workspaceStats.storageLabel },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[--bg-surface] border border-[--border-default] rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-[--text-primary]">{value}</p>
            <p className="text-xs text-[--text-muted] mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[--bg-surface] border border-[--border-default] rounded-xl overflow-hidden shadow-sm">
        <TabBar
          tabs={[...EXEC_TABS]}
          active={tab}
          onChange={(t) => setTab(t as ExecTab)}
        />

        <div className="p-8 space-y-8">
          {tab === 'General' && (
            <>
              <section>
                <SectionHeader title="Your Profile" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ReadOnlyField label="First Name" value={user?.firstName ?? ''} />
                  <ReadOnlyField label="Last Name" value={user?.lastName ?? ''} />
                  <ReadOnlyField label="Email" value={user?.email ?? ''} />
                  <ReadOnlyField label="Role" value={user?.role ?? ''} />
                </div>
              </section>

              <section>
                <SectionHeader title="Workspace Info" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <EditableField
                    label="Workspace Name"
                    value={workspace.name}
                    onChange={(v) => updateWorkspace({ name: v })}
                  />
                  <EditableField label="Company Website" value={companyWebsite} onChange={setCompanyWebsite} />
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveGeneral}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm"
                >
                  Save Changes
                </button>
              </div>

            </>
          )}

          {tab === 'Organization' && (
            <>
              <section>
                <SectionHeader title="BIR Details" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <EditableField
                    label="Tax Identification Number (TIN)"
                    value={workspace.birTin}
                    onChange={(v) => updateWorkspace({ birTin: v })}
                  />
                  <EditableField
                    label="Revenue District Office (RDO)"
                    value={workspace.birRdo}
                    onChange={(v) => updateWorkspace({ birRdo: v })}
                  />
                  <div className="flex items-end pb-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={workspace.vatRegistered}
                        onChange={(e) => updateWorkspace({ vatRegistered: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-[--border-default] rounded"
                      />
                      <span className="text-sm font-medium text-[--text-secondary]">VAT Registered</span>
                    </label>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title="Company Details" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <EditableField label="Business Name (as filed with BIR)" value="AA2000 Corporation" onChange={() => {}} />
                  <EditableField label="Registered Address" value="Manila, Philippines" onChange={() => {}} />
                  <div>
                    <label className="block text-sm font-medium text-[--text-secondary] mb-1">Industry</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full border border-[--border-default] rounded-lg py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[--bg-surface] text-[--text-primary]"
                    >
                      <option>Real Estate</option>
                      <option>Retail</option>
                      <option>Manufacturing</option>
                      <option>Services</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <EditableField label="Fiscal Year End" value={fiscalYear} onChange={setFiscalYear} />
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveOrganization}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm"
                >
                  Save Organization
                </button>
              </div>
            </>
          )}

          {tab === 'Access & Roles' && (
            <>
              <section>
                <div className="flex items-center justify-between mb-4 border-b border-[--border-subtle] pb-2">
                  <h3 className="text-lg font-semibold text-[--text-primary]">
                    Team Members <span className="ml-2 text-sm font-normal text-[--text-muted]">({ALL_USERS.length} total)</span>
                  </h3>
                  <button className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm">
                    + Invite User
                  </button>
                </div>
                <div className="border border-[--border-default] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[--bg-raised] border-b border-[--border-default]">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-[--text-secondary]">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-[--text-secondary]">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-[--text-secondary]">Role</th>
                        <th className="text-left px-4 py-3 font-medium text-[--text-secondary]">Status</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ALL_USERS.map((member) => (
                        <tr key={member.email} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-[--text-primary]">{member.name}</td>
                          <td className="px-4 py-3 text-[--text-muted]">{member.email}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              isExec(member.role)
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded">
                              {member.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-xs text-[--text-muted] hover:text-[--text-primary]">Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <SectionHeader title="Role Permissions Overview" />
                <div className="border border-[--border-default] rounded-lg overflow-hidden text-sm">
                  <table className="w-full">
                    <thead className="bg-[--bg-raised] border-b border-[--border-default]">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-[--text-secondary]">Feature</th>
                        <th className="text-center px-4 py-3 font-medium text-[--text-secondary]">Accountant</th>
                        <th className="text-center px-4 py-3 font-medium text-[--text-secondary]">GM / Exec</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ['Scan & Upload', true, true],
                        ['View Documents', true, true],
                        ['Approve / Decline', true, false],
                        ['BIR Filing', true, false],
                        ['Analytics Dashboard', false, true],
                        ['Executive Reports', false, true],
                        ['Manage Team', false, true],
                        ['Workspace Settings', false, true],
                      ].map(([feat, acc, exec]) => (
                        <tr key={feat as string} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-[--text-secondary]">{feat as string}</td>
                          <td className="px-4 py-2.5 text-center">
                            {acc ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-[--text-muted]">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {exec ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-[--text-muted]">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {tab === 'Data & Privacy' && (
            <>
              <section>
                <SectionHeader title="Data Governance" />
                <div className="space-y-4">
                  {[
                    {
                      label: 'Audit Log',
                      desc: 'Record all user actions (uploads, approvals, exports) in a tamper-resistant log.',
                      value: auditLog,
                      set: setAuditLog,
                    },
                    {
                      label: 'Require Approval for Bulk Exports',
                      desc: 'Any bulk data export must be countersigned by another executive.',
                      value: exportApproval,
                      set: setExportApproval,
                    },
                  ].map(({ label, desc, value, set }) => (
                    <div key={label} className="flex items-center justify-between p-4 border border-[--border-default] rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-[--text-primary]">{label}</p>
                        <p className="text-xs text-[--text-muted] mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => set((v) => !v)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          value ? 'bg-blue-600' : 'bg-[--bg-raised]'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            value ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <SectionHeader title="Data Retention" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[--text-secondary] mb-1">
                      Document Retention Period
                    </label>
                    <select
                      value={dataRetention}
                      onChange={(e) => setDataRetention(e.target.value)}
                      className="w-full border border-[--border-default] rounded-lg py-2 px-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[--bg-surface] text-[--text-primary]"
                    >
                      <option value="6">6 months</option>
                      <option value="12">12 months</option>
                      <option value="24">24 months</option>
                      <option value="60">5 years (BIR requirement)</option>
                      <option value="0">Indefinite</option>
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title="Data Export" />
                <div className="bg-[--bg-raised] border border-[--border-default] rounded-lg p-5 flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-[--text-primary]">Download Full Workspace Backup</h4>
                    <p className="text-sm text-[--text-muted] mt-1">
                      Export all documents, transactions, and audit logs as a ZIP archive.
                    </p>
                  </div>
                  <button className="bg-slate-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-900 transition text-sm">
                    Request Export
                  </button>
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveGovernance}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition text-sm"
                >
                  Save Governance Settings
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Root export
// ═══════════════════════════════════════════════════════════════════════════════
export function Settings() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return isExec(user.role) ? <ExecutiveSettings /> : <AccountantSettings />;
}

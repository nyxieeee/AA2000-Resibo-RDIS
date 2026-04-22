import { useState, useMemo, useEffect } from 'react';
import { 
  Monitor, Smartphone, ShieldCheck, Key, RefreshCw, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { cn } from '../../lib/utils';

// --- Section Headers & Helpers ---
const EXEC_ROLES = ['CEO', 'President', 'General Manager'] as const;
type ExecRole = typeof EXEC_ROLES[number];
const isExec = (role: string): role is ExecRole => EXEC_ROLES.includes(role as ExecRole);

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-lg font-semibold text-[--text-primary] border-b border-[--border-subtle] pb-2 mb-4">
      {title}
    </h3>
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
              ? 'px-5 py-3 border-b-2 border-blue-600 text-blue-600 bg-[--bg-surface] shrink-0'
              : 'px-5 py-3 border-b-2 border-transparent hover:text-[--text-primary] hover:bg-[--bg-page] transition shrink-0'
          }
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

const ACCOUNTANT_TABS = ['Profile', 'BIR Configurations', 'Categories', 'Security', 'Notifications'] as const;
type AccountantTab = typeof ACCOUNTANT_TABS[number];

function AccountantSettings() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const fetchSessions = useAuthStore((s) => s.fetchSessions);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const [tab, setTab] = useState<AccountantTab>('Profile');
  const [isSaving, setIsSaving] = useState(false);
  const [recentSuccess, setRecentSuccess] = useState<string | null>(null);

  // Profile Draft State
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', role: 'Accountant' as any });

  // BIR Draft State
  const [birTin, setBirTin] = useState('');
  const [birRdo, setBirRdo] = useState('');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [filingFreq, setFilingFreq] = useState('Monthly');
  const [taxRate, setTaxRate] = useState('2');

  // Categories & Prefs
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifInApp, setNotifInApp] = useState(true);
  const [notifReview, setNotifReview] = useState(false);


  useEffect(() => {
    if (user) setProfile({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
  }, [user]);

  useEffect(() => {
    if (workspace) {
      setBirTin(workspace.birTin || '');
      setBirRdo(workspace.birRdo || '');
      setVatRegistered(!!workspace.vatRegistered);
      setCategories(workspace.expenseCategories || []);
      setFilingFreq(workspace.filingFrequency || 'Monthly');
      setTaxRate(String(workspace.withholdingTaxRate || '2'));
    }
  }, [workspace]);

  useEffect(() => {
    const handler = (e: any) => {
      const newTab = e.detail;
      if (ACCOUNTANT_TABS.includes(newTab as any)) {
        setTab(newTab as AccountantTab);
      }
    };
    window.addEventListener('settings-tab-change', handler);
    return () => window.removeEventListener('settings-tab-change', handler);
  }, []);

  const triggerSuccess = (key: string) => {
    setRecentSuccess(key);
    setTimeout(() => setRecentSuccess(null), 3000);
  };

  const notify = (title: string) => {
    if (user?.id) addNotification(user.id, { title, message: 'Changes saved successfully.', type: 'success' });
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    const ok = await updateProfile(profile);
    if (ok) { triggerSuccess('profile'); notify('Profile Updated'); }
    setIsSaving(false);
  };

  const handleSaveBIR = async () => {
    setIsSaving(true);
    const ok = await updateWorkspace({ birTin, birRdo, vatRegistered, filingFrequency: filingFreq, withholdingTaxRate: Number(taxRate) });
    if (ok) {
      triggerSuccess('bir');
      notify('BIR Settings Saved');
    }
    setIsSaving(false);
  };

  const handleSaveCategories = async () => {
    setIsSaving(true);
    const ok = await updateWorkspace({ expenseCategories: categories });
    if (ok) {
      triggerSuccess('categories');
      notify('Categories Updated');
    }
    setIsSaving(false);
  };

  const handleSavePreferences = async () => {
    triggerSuccess('prefs');
    notify('Preferences Saved');
  };


  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Accountant Settings</h1>
        <p className="text-[--text-muted] mt-1">Manage your identity and BIR configurations.</p>
      </div>

      <div className="bg-[--bg-surface] border border-[--border-default] rounded-xl overflow-hidden shadow-sm">
        <TabBar tabs={[...ACCOUNTANT_TABS]} active={tab} onChange={(t) => setTab(t as AccountantTab)} />

        <div className="p-6 md:p-8 space-y-8">
          {tab === 'Profile' && (
            <section>
              <SectionHeader title="Your Identity" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EditableField label="First Name" value={profile.firstName} onChange={(v) => setProfile(p => ({ ...p, firstName: v }))} />
                <EditableField label="Last Name" value={profile.lastName} onChange={(v) => setProfile(p => ({ ...p, lastName: v }))} />
                <EditableField label="Email Address" value={profile.email} onChange={(v) => setProfile(p => ({ ...p, email: v }))} />
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-1">Company Role</label>
                  <select
                    value={profile.role}
                    onChange={(e) => setProfile(p => ({ ...p, role: e.target.value as any }))}
                    className="w-full border border-[--border-default] rounded-lg py-2 px-3 bg-[--bg-surface] text-[--text-primary]"
                  >
                    <option>Accountant</option>
                    <option>Junior Accountant</option>
                    <option>Finance Officer</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  className={`px-5 py-2 rounded-lg font-medium transition text-sm ${recentSuccess === 'profile' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {recentSuccess === 'profile' ? 'Saved!' : isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </section>
          )}

          {tab === 'BIR Configurations' && (
            <>
              <section>
                <SectionHeader title="Taxation Details" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <EditableField label="TIN" value={birTin} onChange={setBirTin} />
                  <EditableField label="RDO Code" value={birRdo} onChange={setBirRdo} />
                  <div className="flex items-end pb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
                      <span className="text-sm text-[--text-secondary]">VAT Registered</span>
                    </label>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeader title="Filing Rules" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-[--text-secondary] mb-1">Frequency</label>
                    <select value={filingFreq} onChange={(e) => setFilingFreq(e.target.value)} className="w-full border border-[--border-default] rounded-lg py-2 px-3 bg-[--bg-surface] text-[--text-primary]">
                      <option>Monthly</option>
                      <option>Quarterly</option>
                    </select>
                  </div>
                  <EditableField label="Withholding Tax (%)" value={taxRate} onChange={setTaxRate} type="number" />
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveBIR}
                  className={`px-5 py-2 rounded-lg font-medium transition text-sm ${recentSuccess === 'bir' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {recentSuccess === 'bir' ? 'Saved!' : isSaving ? 'Saving...' : 'Save BIR Settings'}
                </button>
              </div>
            </>
          )}

          {tab === 'Categories' && (
            <section>
              <SectionHeader title="Expense Categories" />
              <ul className="divide-y divide-[--border-subtle] border border-[--border-default] rounded-lg mb-5 max-h-60 overflow-y-auto bg-white">
                {categories.map((cat, i) => (
                  <li key={`${cat}-${i}`} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-[--text-secondary]">{cat}</span>
                    <button onClick={() => setCategories(categories.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-700 font-medium">Remove</button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category..." className="flex-1 border border-[--border-default] rounded-lg px-3 py-2 text-sm bg-[--bg-surface] text-[--text-primary]" />
                <button onClick={() => { if (newCat.trim()) { setCategories([...categories, newCat.trim()]); setNewCat(''); } }} className="bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium text-[--text-primary]">Add</button>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveCategories}
                  className={`px-5 py-2 rounded-lg font-medium transition text-sm ${recentSuccess === 'categories' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-900'
                    }`}
                >
                  {recentSuccess === 'categories' ? 'Saved!' : isSaving ? 'Saving...' : 'Save Categories'}
                </button>
              </div>
            </section>
          )}

          {tab === 'Notifications' && (
            <section>
              <SectionHeader title="Alert Preferences" />
              <div className="space-y-3">
                {[
                  { label: 'Email Alerts', value: notifEmail, set: setNotifEmail },
                  { label: 'In-App Alerts', value: notifInApp, set: setNotifInApp },
                  { label: 'Confidence Threshold Alerts', value: notifReview, set: setNotifReview },
                ].map(({ label, value, set }) => (
                  <div key={label} className="flex items-center justify-between p-4 border border-[--border-default] rounded-lg">
                    <span className="text-sm text-[--text-primary] font-medium">{label}</span>
                    <button onClick={() => set(!value)} className={`h-6 w-11 rounded-full relative transition-colors ${value ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      <span className={`absolute top-1 left-1 bg-white h-4 w-4 rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className={`px-5 py-2 rounded-lg font-medium transition text-sm ${recentSuccess === 'prefs' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {recentSuccess === 'prefs' ? 'Saved!' : 'Save Preferences'}
                </button>
              </div>
            </section>
          )}

          {tab === 'Security' && (
            <SecurityCenter isExec={false} />
          )}
        </div>
      </div>
    </div>
  );
}

const EXEC_TABS = ['General', 'Organization', 'Access & Roles', 'Security', 'Data & Privacy'] as const;
type ExecTab = typeof EXEC_TABS[number];

function ExecutiveSettings() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const allUsers = useAuthStore((s) => s.allUsers);
  const fetchAllUsers = useAuthStore((s) => s.fetchAllUsers);
  const fetchSessions = useAuthStore((s) => s.fetchSessions);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const documents = useDocumentStore((s) => s.documents);

  useEffect(() => {
    fetchAllUsers();
    fetchSessions();
  }, [fetchAllUsers, fetchSessions]);

  const [tab, setTab] = useState<ExecTab>('General');
  const [isSaving, setIsSaving] = useState(false);
  const [recentSuccess, setRecentSuccess] = useState<string | null>(null);

  // Profile
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', role: 'CEO' as any });

  // Organization
  const [businessName, setBusinessName] = useState('');
  const [registeredAddress, setRegisteredAddress] = useState('');
  const [birTin, setBirTin] = useState('');
  const [birRdo, setBirRdo] = useState('');
  const [vatRegistered, setVatRegistered] = useState(false);
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');

  // Governance
  const [dataRetention, setDataRetention] = useState('12');
  const [auditLog, setAuditLog] = useState(true);
  const [exportApproval, setExportApproval] = useState(true);

  // Security

  useEffect(() => {
    if (user) setProfile({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
  }, [user]);

  useEffect(() => {
    if (workspace) {
      setBusinessName(workspace.name || '');
      setRegisteredAddress(workspace.registeredAddress || '');
      setBirTin(workspace.birTin || '');
      setBirRdo(workspace.birRdo || '');
      setVatRegistered(!!workspace.vatRegistered);
      setCompanyWebsite(workspace.companyWebsite || '');
      setIndustry(workspace.industry || '');
      setFiscalYear(workspace.fiscalYearEnd || '');
      setDataRetention(workspace.dataRetentionPeriod || '12');
      setAuditLog(!!workspace.auditLogEnabled);
      setExportApproval(!!workspace.exportApprovalRequired);
    }
  }, [workspace]);

  useEffect(() => {
    const handler = (e: any) => {
      const newTab = e.detail;
      if (EXEC_TABS.includes(newTab as any)) {
        setTab(newTab as ExecTab);
      }
    };
    window.addEventListener('settings-tab-change', handler);
    return () => window.removeEventListener('settings-tab-change', handler);
  }, []);

  const triggerSuccess = (key: string) => {
    setRecentSuccess(key);
    setTimeout(() => setRecentSuccess(null), 3000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    const ok = await updateProfile(profile);
    if (ok) triggerSuccess('profile');
    setIsSaving(false);
  };

  const handleSaveOrganization = async () => {
    setIsSaving(true);
    const ok = await updateWorkspace({ name: businessName, registeredAddress, birTin, birRdo, vatRegistered, companyWebsite, industry, fiscalYearEnd: fiscalYear });
    if (ok) triggerSuccess('org');
    setIsSaving(false);
  };

  const handleSaveGovernance = async () => {
    setIsSaving(true);
    const ok = await updateWorkspace({ dataRetentionPeriod: dataRetention, auditLogEnabled: auditLog, exportApprovalRequired: exportApproval });
    if (ok) triggerSuccess('gov');
    setIsSaving(false);
  };


  const workspaceStats = useMemo(() => {
    const bytes = documents.length * 200 * 1024;
    return { users: allUsers.length || 0, uploads: documents.length, storage: `${(bytes / (1024 * 1024)).toFixed(1)} MB` };
  }, [documents, allUsers]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <h1 className="text-2xl font-bold">Executive Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Team Members', val: workspaceStats.users },
          { label: 'Processed Documents', val: workspaceStats.uploads },
          { label: 'Storage', val: workspaceStats.storage }
        ].map(s => (
          <div key={s.label} className="bg-[--bg-surface] p-6 rounded-xl border border-[--border-default]">
            <p className="text-xs font-semibold text-[--text-muted] uppercase">{s.label}</p>
            <p className="text-3xl font-bold mt-2">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-[--bg-surface] border border-[--border-default] rounded-xl overflow-hidden shadow-lg">
        <TabBar tabs={[...EXEC_TABS]} active={tab} onChange={(t) => setTab(t as ExecTab)} />

        <div className="p-6 md:p-8 space-y-8">
          {tab === 'General' && (
            <section>
              <SectionHeader title="Your Executive Profile" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <EditableField label="First Name" value={profile.firstName} onChange={(v) => setProfile(p => ({ ...p, firstName: v }))} />
                <EditableField label="Last Name" value={profile.lastName} onChange={(v) => setProfile(p => ({ ...p, lastName: v }))} />
                <EditableField label="Corporate Email" value={profile.email} onChange={(v) => setProfile(p => ({ ...p, email: v }))} />
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-1">Rank</label>
                  <select
                    value={profile.role}
                    onChange={(e) => setProfile(p => ({ ...p, role: e.target.value as any }))}
                    className="w-full border border-[--border-default] rounded-lg py-2 px-3 bg-[--bg-surface] text-[--text-primary]"
                  >
                    {EXEC_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  className={`px-6 py-2 rounded-lg font-bold transition ${recentSuccess === 'profile' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {recentSuccess === 'profile' ? 'Saved!' : isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </section>
          )}

          {tab === 'Organization' && (
            <div className="space-y-10">
              <section>
                <SectionHeader title="Corporate Branding" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <EditableField label="Public Name" value={businessName} onChange={setBusinessName} />
                  <EditableField label="Website" value={companyWebsite} onChange={setCompanyWebsite} />
                </div>
              </section>

              <section>
                <SectionHeader title="Compliance" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <EditableField label="TIN" value={birTin} onChange={setBirTin} />
                  <EditableField label="RDO" value={birRdo} onChange={setBirRdo} />
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={vatRegistered} onChange={(e) => setVatRegistered(e.target.checked)} className="h-4 w-4 rounded" />
                      <span className="text-sm font-medium">VAT Registered</span>
                    </label>
                  </div>
                </div>
              </section>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSaveOrganization}
                  className={`px-8 py-2 rounded-lg font-bold transition ${recentSuccess === 'org' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                  {recentSuccess === 'org' ? 'Saved!' : isSaving ? 'Saving...' : 'Save Organization'}
                </button>
              </div>
            </div>
          )}

          {tab === 'Access & Roles' && (
            <section>
              <h3 className="text-lg font-bold mb-4">IAM Control</h3>
              <div className="border border-[--border-default] rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-5">Entity</th>
                      <th className="px-5 py-5">Role</th>
                      <th className="px-5 py-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {allUsers.map(u => (
                      <tr key={u.email} className="border-t">
                        <td className="px-5 py-5">{u.name}<br /><span className="text-xs text-slate-400">{u.email}</span></td>
                        <td className="px-5 py-5"><span className="text-xs font-bold uppercase">{u.role}</span></td>
                        <td className="px-5 py-5"><span className="text-emerald-500 font-bold">{u.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Data & Privacy' && (
            <div className="space-y-8">
              <section>
                <SectionHeader title="Governance" />
                <div className="space-y-4">
                  {[
                    { label: 'Audit Log', val: auditLog, set: setAuditLog },
                    { label: 'Export Approval', val: exportApproval, set: setExportApproval }
                  ].map(p => (
                    <div key={p.label} className="p-4 border border-[--border-default] rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold">{p.label}</span>
                      <button onClick={() => p.set(!p.val)} className={`h-6 w-11 rounded-full relative transition-all ${p.val ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                        <span className={`absolute top-1 left-1 bg-white h-4 w-4 rounded-full transition-transform ${p.val ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveGovernance}
                  className={`px-8 py-2 rounded-lg font-bold transition ${recentSuccess === 'gov' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-black'
                    }`}
                >
                  {recentSuccess === 'gov' ? 'Saved!' : isSaving ? 'Saving...' : 'Save Governance'}
                </button>
              </div>
            </div>
          )}

          {tab === 'Security' && (
             <SecurityCenter isExec={true} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Security Center Sub-components ---

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: 'No Password', color: 'bg-slate-200' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score === 1) return { score, label: 'Weak', color: 'bg-rose-500' };
    if (score === 2) return { score, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-emerald-500' };
  }, [password]);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-[--text-muted]">Security Strength: <span className={cn('font-bold', strength.color.replace('bg-', 'text-'))}>{strength.label}</span></span>
        <span className="text-[--text-muted]">{strength.score}/4 points</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className={cn('h-full flex-1 transition-all duration-500', step <= strength.score ? strength.color : 'bg-transparent')} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
        <SecurityRequirement met={password.length >= 8} label="8+ Characters" />
        <SecurityRequirement met={/[A-Z]/.test(password)} label="Upper Case" />
        <SecurityRequirement met={/[0-9]/.test(password)} label="Number" />
        <SecurityRequirement met={/[^A-Za-z0-9]/.test(password)} label="Symbol" />
      </div>
    </div>
  );
}

function SecurityRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertCircle className="h-3 w-3 text-slate-300 dark:text-slate-600" />}
      <span className={cn('text-[10px] font-medium transition-colors', met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>{label}</span>
    </div>
  );
}

function SecurityCard({ title, icon: Icon, description, active, onToggle }: { title: string; icon: any; description: string; active?: boolean; onToggle?: () => void }) {
  return (
    <div className="p-4 border border-[--border-default] rounded-xl bg-[--bg-surface] flex items-start gap-4 group hover:border-blue-500/30 transition-all duration-300">
      <div className="mt-1 h-10 w-10 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-[--text-primary]">{title}</h4>
          {onToggle && (
            <button onClick={onToggle} className={cn('h-5 w-9 rounded-full relative transition-all duration-300', active ? 'bg-emerald-500' : 'bg-slate-200')}>
              <span className={cn('absolute top-0.5 left-0.5 bg-white h-4 w-4 rounded-full transition-transform duration-300 shadow-sm', active ? 'translate-x-4' : 'translate-x-0')} />
            </button>
          )}
        </div>
        <p className="text-xs text-[--text-muted] mt-1 leading-relaxed">{description}</p>
        {!onToggle && <button className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-2 hover:underline flex items-center gap-0.5">Setup Now <Key className="h-2.5 w-2.5" /></button>}
      </div>
    </div>
  );
}

function SessionList() {
  const sessions = useAuthStore(s => s.sessions);
  
  if (!sessions || sessions.length === 0) {
    return (
      <div className="mt-8 py-10 border border-dashed border-[--border-subtle] rounded-xl flex flex-col items-center justify-center text-center">
        <ShieldCheck className="h-8 w-8 text-slate-200 dark:text-slate-800 mb-2" />
        <p className="text-sm text-[--text-muted]">No active sessions found.</p>
      </div>
    );
  }

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.round(diffMs / 60000);
      
      if (diffMins < 1) return 'Active Now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-[--text-muted] uppercase tracking-wider">Active Sessions</h4>
        <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700">Log out all</button>
      </div>
      <div className="space-y-2">
        {sessions.map((s, idx) => (
          <div key={s.id || idx} className="flex items-center gap-3 p-3 rounded-lg border border-[--border-subtle] bg-[--bg-raised]/30 hover:bg-[--bg-raised] transition-colors">
            {s.device === 'Desktop' ? <Monitor className="h-4 w-4 text-[--text-muted]" /> : <Smartphone className="h-4 w-4 text-[--text-muted]" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[--text-primary] truncate">{s.browser}</span>
                {idx === 0 && <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">Current</span>}
              </div>
              <p className="text-[10px] text-[--text-muted] mt-0.5">{s.location} • {formatRelativeTime(s.time)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityCenter({ isExec }: { isExec: boolean }) {
  const user = useAuthStore(s => s.user);
  const changePassword = useAuthStore(s => s.changePassword);
  const addNotification = useNotificationStore(s => s.addNotification);

  const [isSaving, setIsSaving] = useState(false);
  const [recentSuccess, setRecentSuccess] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const handleSavePassword = async () => {
    setPassError(null);
    if (!passwords.current || !passwords.next || !passwords.confirm) {
      setPassError('All fields are required');
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPassError('Passwords do not match');
      return;
    }
    if (passwords.next.length < 8) {
      setPassError('Password must be at least 8 characters');
      return;
    }

    setIsSaving(true);
    const res = await changePassword(passwords.current, passwords.next);
    if (res.success) {
      setRecentSuccess(true);
      if (user?.id) addNotification(user.id, { title: 'Security Updated', message: 'Your password has been changed successfully.', type: 'success' });
      setPasswords({ current: '', next: '', confirm: '' });
      setTimeout(() => setRecentSuccess(false), 3000);
    } else {
      setPassError(res.error || 'Failed to update password');
    }
    setIsSaving(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Password Management */}
      <div className="lg:col-span-12 xl:col-span-5 space-y-6">
        <section className="bg-[--bg-surface] border border-[--border-default] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[--text-primary] leading-tight">Password Management</h3>
              <p className="text-xs text-[--text-muted]">Update your administrative credentials here.</p>
            </div>
          </div>

          <div className="space-y-4">
            <EditableField label="Current Password" type="password" value={passwords.current} onChange={(v) => setPasswords(p => ({ ...p, current: v }))} />
            
            <div className="space-y-1">
              <EditableField label="New Password" type="password" value={passwords.next} onChange={(v) => setPasswords(p => ({ ...p, next: v }))} />
              <PasswordStrengthMeter password={passwords.next} />
            </div>

            <EditableField label="Confirm New Password" type="password" value={passwords.confirm} onChange={(v) => setPasswords(p => ({ ...p, confirm: v }))} />

            {passError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-3 rounded-lg text-xs font-medium border border-rose-200 dark:border-rose-900/50 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {passError}
              </div>
            )}

            <button
              onClick={handleSavePassword}
              disabled={isSaving}
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm',
                recentSuccess 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
              )}
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : recentSuccess ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {recentSuccess ? (isExec ? 'Credentials Updated!' : 'Password Updated!') : isSaving ? 'Updating...' : isExec ? 'Update Administrative Password' : 'Update Account Password'}
            </button>
          </div>
        </section>
      </div>

      {/* Right Column: Security Health & Activity */}
      <div className="lg:col-span-12 xl:col-span-7 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SecurityCard 
            title="Multi-Factor Auth" 
            icon={Smartphone} 
            description="Add an extra layer of security to your corporate account using your mobile device." 
            active={mfaEnabled} 
            onToggle={() => setMfaEnabled(!mfaEnabled)} 
          />
          <SecurityCard 
            title="Account Recovery" 
            icon={Key} 
            description="Ensure your recovery email and phone number are up to date for emergency access." 
          />
        </div>

        <section className="bg-[--bg-surface] border border-[--border-default] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
              <Monitor className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-[--text-primary]">Security Activity Logs</h3>
          </div>
          <p className="text-xs text-[--text-muted] mb-4">Review recently active devices and sign-in locations.</p>
          
          <SessionList />

          <div className="mt-8 pt-6 border-t border-[--border-subtle]">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Account Security Score: 85%</span>
            </div>
            <p className="text-[10px] text-[--text-muted] mt-1.5">Your account is well protected. Consider enabling MFA to reach 100%.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export function Settings() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return isExec(user.role) ? <ExecutiveSettings /> : <AccountantSettings />;
}

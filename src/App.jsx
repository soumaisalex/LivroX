import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Receipt,
  Tags,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCircle2,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { supabase } from './lib/supabase';

const menuItems = [
  { id: 'book', label: 'Transações', icon: Receipt },
  { id: 'categories', label: 'Categorias', icon: Tags },
  { id: 'accounts', label: 'Contas', icon: Building2 },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'profile', label: 'Perfil', icon: UserCircle2 }
];

const emptyTransaction = {
  id: '',
  description: '',
  amount: '',
  effective_date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  category_id: '',
  account_id: ''
};

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getMonthRange(month, year) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('book');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const [company, setCompany] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [sessionUser, setSessionUser] = useState({ id: '', username: '', role: 'member', company_id: null });
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [txForm, setTxForm] = useState(emptyTransaction);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  const [setupForm, setSetupForm] = useState({
    companyName: '',
    accountsText: 'Banco do Brasil\nDinheiro\nSantander',
    incomeText: 'Vendas\nServiços',
    expenseText: 'Aluguel\nFornecedores'
  });

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'member' });
  const [editingUserId, setEditingUserId] = useState('');
  const [editingUser, setEditingUser] = useState({ username: '', role: 'member', password: '' });
  const [profile, setProfile] = useState({ username: '', password: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' });
  const [accountForm, setAccountForm] = useState({ name: '', kind: 'bank' });

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (company?.id && setupDone && loggedIn) loadTransactions();
  }, [company?.id, setupDone, loggedIn, selectedMonth, selectedYear, search, categoryFilter, typeFilter]);

  async function bootstrap() {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data: companyRows, error: companyError } = await supabase.from('companies').select('*').limit(1);
      if (companyError) throw companyError;
      const companyData = companyRows?.[0] ?? null;
      if (!companyData) {
        setSetupDone(false);
        return;
      }

      setCompany(companyData);
      const [onboardingRes, accountsRes, categoriesRes, usersRes] = await Promise.all([
        supabase.from('company_onboarding').select('*').eq('company_id', companyData.id).limit(1),
        supabase.from('accounts').select('*').eq('company_id', companyData.id).order('name'),
        supabase.from('categories').select('*').eq('company_id', companyData.id).order('name'),
        supabase.from('app_users').select('*').eq('company_id', companyData.id).order('created_at', { ascending: false })
      ]);

      const queryErrors = [onboardingRes.error, accountsRes.error, categoriesRes.error, usersRes.error].filter(Boolean);
      if (queryErrors.length) throw queryErrors[0];

      setSetupDone(onboardingRes.data?.[0]?.completed ?? false);
      setAccounts(accountsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setUsers(usersRes.data ?? []);
    } catch (error) {
      setErrorMessage(`Erro ao carregar dados: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions() {
    const { from, to } = getMonthRange(selectedMonth, selectedYear);
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('company_id', company.id)
      .eq('deleted', false)
      .gte('effective_date', from)
      .lte('effective_date', to)
      .order('effective_date', { ascending: false });

    if (search.trim()) query = query.ilike('description', `%${search.trim()}%`);
    if (categoryFilter) query = query.eq('category_id', categoryFilter);
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);

    const { data, error } = await query;
    if (error) return setErrorMessage(`Erro ao carregar transações: ${error.message}`);
    setTransactions(data ?? []);
  }

  async function runSetup(e) {
    e.preventDefault();
    setErrorMessage('');

    try {
      const accountsInput = setupForm.accountsText.split('\n').map((v) => v.trim()).filter(Boolean);
      const incomeInput = setupForm.incomeText.split('\n').map((v) => v.trim()).filter(Boolean);
      const expenseInput = setupForm.expenseText.split('\n').map((v) => v.trim()).filter(Boolean);

      const { data: insertedCompany, error: companyInsertError } = await supabase.from('companies').insert({ name: setupForm.companyName }).select('*').single();
      if (companyInsertError) throw companyInsertError;
      const companyId = insertedCompany.id;

      const { error: masterUserError } = await supabase.from('app_users').insert({
        id: crypto.randomUUID(),
        company_id: companyId,
        username: 'master',
        password: 'master123',
        role: 'master'
      });
      if (masterUserError) throw masterUserError;

      if (accountsInput.length) {
        const { error } = await supabase.from('accounts').insert(accountsInput.map((name) => ({ company_id: companyId, name, kind: 'bank' })));
        if (error) throw error;
      }
      if (incomeInput.length) {
        const { error } = await supabase.from('categories').insert(incomeInput.map((name) => ({ company_id: companyId, name, type: 'income' })));
        if (error) throw error;
      }
      if (expenseInput.length) {
        const { error } = await supabase.from('categories').insert(expenseInput.map((name) => ({ company_id: companyId, name, type: 'expense' })));
        if (error) throw error;
      }

      const { error: onboardingError } = await supabase.from('company_onboarding').upsert({ company_id: companyId, completed: true, completed_at: new Date().toISOString() });
      if (onboardingError) throw onboardingError;

      await bootstrap();
      setLoggedIn(false);
    } catch (error) {
      setErrorMessage(`Erro ao finalizar configuração: ${error?.message || 'erro desconhecido'}`);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMessage('');
    const { data, error } = await supabase.from('app_users').select('*').eq('company_id', company.id).eq('username', loginForm.username).limit(1);
    if (error) return setErrorMessage(`Erro no login: ${error.message}`);
    const user = data?.[0];
    if (!user || user.password !== loginForm.password) return setErrorMessage('Login ou senha inválidos.');

    setSessionUser({ id: user.id, username: user.username, role: user.role, company_id: user.company_id });
    setProfile({ username: user.username, password: '' });
    setLoggedIn(true);
    setLoginForm({ username: '', password: '' });
  }

  function handleLogout() {
    setLoggedIn(false);
    setActiveTab('book');
  }

  function openCreateTransaction() {
    setTxForm(emptyTransaction);
    setIsTxModalOpen(true);
  }

  function openEditTransaction(tx) {
    setTxForm({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      effective_date: tx.effective_date,
      type: tx.type,
      category_id: tx.category_id,
      account_id: tx.account_id
    });
    setIsTxModalOpen(true);
  }

  async function saveTransaction(e) {
    e.preventDefault();
    const payload = {
      description: txForm.description,
      amount: Number(txForm.amount),
      effective_date: txForm.effective_date,
      type: txForm.type,
      category_id: txForm.category_id,
      account_id: txForm.account_id,
      company_id: company.id,
      deleted: false,
      deleted_by: null,
      deleted_at: null
    };

    if (txForm.id) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', txForm.id);
      if (error) return setErrorMessage(`Erro ao editar transação: ${error.message}`);
    } else {
      const { error } = await supabase.from('transactions').insert({ ...payload, created_by: sessionUser.id });
      if (error) return setErrorMessage(`Erro ao criar transação: ${error.message}`);
    }

    setIsTxModalOpen(false);
    await loadTransactions();
  }

  async function deleteTransaction(id) {
    if (!confirm('Confirma exclusão desta transação?')) return;
    const { error } = await supabase.from('transactions').update({ deleted: true, deleted_by: sessionUser.id, deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) return setErrorMessage(`Erro ao excluir transação: ${error.message}`);
    await loadTransactions();
  }

  async function createCategory(e) {
    e.preventDefault();
    const { error } = await supabase.from('categories').insert({ company_id: company.id, name: categoryForm.name, type: categoryForm.type });
    if (error) return setErrorMessage(`Erro ao criar categoria: ${error.message}`);
    setCategoryForm({ name: '', type: 'expense' });
    await bootstrap();
  }

  async function deleteCategory(id) {
    if (!confirm('Excluir categoria?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return setErrorMessage(`Erro ao excluir categoria: ${error.message}`);
    await bootstrap();
  }

  async function createAccount(e) {
    e.preventDefault();
    const { error } = await supabase.from('accounts').insert({ company_id: company.id, name: accountForm.name, kind: accountForm.kind });
    if (error) return setErrorMessage(`Erro ao criar conta: ${error.message}`);
    setAccountForm({ name: '', kind: 'bank' });
    await bootstrap();
  }

  async function deleteAccount(id) {
    if (!confirm('Excluir conta?')) return;
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) return setErrorMessage(`Erro ao excluir conta: ${error.message}`);
    await bootstrap();
  }

  async function createUser(e) {
    e.preventDefault();
    const { error } = await supabase.from('app_users').insert({ id: crypto.randomUUID(), company_id: company.id, username: newUser.username, password: newUser.password, role: newUser.role });
    if (error) return setErrorMessage(`Erro ao criar usuário: ${error.message}`);
    setNewUser({ username: '', password: '', role: 'member' });
    await bootstrap();
  }

  function startEditUser(user) {
    setEditingUserId(user.id);
    setEditingUser({ username: user.username, role: user.role, password: user.password || '' });
  }

  async function saveUserEdit() {
    const { error } = await supabase.from('app_users').update({ username: editingUser.username, role: editingUser.role, password: editingUser.password }).eq('id', editingUserId);
    if (error) return setErrorMessage(`Erro ao atualizar usuário: ${error.message}`);
    setEditingUserId('');
    await bootstrap();
  }

  async function deleteUser(id) {
    if (!confirm('Excluir usuário?')) return;
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) return setErrorMessage(`Erro ao excluir usuário: ${error.message}`);
    await bootstrap();
  }

  async function updateProfile(e) {
    e.preventDefault();
    const payload = { username: profile.username };
    if (profile.password.trim()) payload.password = profile.password;
    const { error } = await supabase.from('app_users').update(payload).eq('id', sessionUser.id);
    if (error) return setErrorMessage(`Erro ao atualizar perfil: ${error.message}`);
    setProfile((p) => ({ ...p, password: '' }));
    await bootstrap();
  }

  const totals = useMemo(() => transactions.reduce((acc, tx) => {
    if (tx.type === 'income') acc.income += Number(tx.amount);
    else acc.expense += Number(tx.amount);
    return acc;
  }, { income: 0, expense: 0 }), [transactions]);

  const balance = totals.income - totals.expense;
  const isMaster = sessionUser.role === 'master';
  const visibleMenuItems = menuItems.filter((item) => (item.id === 'users' ? isMaster : true));
  const fieldClass = 'rounded-xl bg-slate-100/80 border-slate-200 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400';

  useEffect(() => {
    if (!isMaster && activeTab === 'users') setActiveTab('book');
  }, [isMaster, activeTab]);

  if (loading) return <main className="min-h-screen grid place-items-center text-slate-500">Carregando...</main>;

  const cardBase = 'bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 p-5';

  if (!setupDone) {
    return (
      <main className="min-h-screen grid place-items-center p-4 bg-slate-50">
        <section className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold tracking-tight">Primeiro acesso • LivroX</h1>
          <p className="text-slate-500 mt-1 mb-4">Cadastre a estrutura inicial da empresa.</p>
          <form className="grid gap-3" onSubmit={runSetup}>
            <label className="text-sm text-slate-600">Empresa<input className="mt-1 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" required value={setupForm.companyName} onChange={(e) => setSetupForm((p) => ({ ...p, companyName: e.target.value }))} /></label>
            <label className="text-sm text-slate-600">Bancos / Carteiras<textarea className="mt-1 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" rows={3} value={setupForm.accountsText} onChange={(e) => setSetupForm((p) => ({ ...p, accountsText: e.target.value }))} /></label>
            <label className="text-sm text-slate-600">Categorias de receita<textarea className="mt-1 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" rows={3} value={setupForm.incomeText} onChange={(e) => setSetupForm((p) => ({ ...p, incomeText: e.target.value }))} /></label>
            <label className="text-sm text-slate-600">Categorias de despesa<textarea className="mt-1 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" rows={3} value={setupForm.expenseText} onChange={(e) => setSetupForm((p) => ({ ...p, expenseText: e.target.value }))} /></label>
            <button className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white">Finalizar configuração</button>
          </form>
          {errorMessage && <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen grid place-items-center p-4 bg-slate-50">
        <section className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold tracking-tight">Entrar no LivroX</h1>
          <form className="grid gap-3 mt-4" onSubmit={handleLogin}>
            <input className="rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" placeholder="Login" required value={loginForm.username} onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))} />
            <input className="rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" placeholder="Senha" type="password" required value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
            <button className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white">Entrar</button>
          </form>
          {errorMessage && <p className="mt-3 text-sm text-rose-600">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static z-50 inset-y-0 left-0 w-72 p-4 transform transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-full rounded-2xl border border-white/20 bg-slate-900/90 backdrop-blur-md p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">LivroX</h2>
            <button className="lg:hidden bg-white/10 text-white" onClick={() => setSidebarOpen(false)}><X size={16} /></button>
          </div>
          <p className="text-slate-400 text-sm mb-5">{company?.name}</p>

          <nav className="space-y-1 flex-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-300 ${activeTab === item.id ? 'bg-white/10 text-white border-l-4 border-emerald-500' : 'text-slate-300 hover:bg-white/10'}`}>
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 pt-3 mt-2">
            <p className="text-slate-300 text-sm">{sessionUser.username}</p>
            <button onClick={handleLogout} className="mt-2 w-full flex items-center justify-center gap-2 bg-white/10 text-slate-200 hover:bg-white/20 transition-all duration-300"><LogOut size={16} />Sair</button>
          </div>
        </div>
      </aside>

      <section className="flex-1 p-4 lg:p-6 space-y-4">
        <header className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="lg:hidden bg-slate-100 text-slate-700" onClick={() => setSidebarOpen(true)}><Menu size={18} /></button>
            <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-2 py-1">
            <button className="bg-transparent text-slate-600 hover:text-slate-900" onClick={() => setSelectedMonth((m) => (m === 0 ? 11 : m - 1))}>‹</button>
            <span className="font-semibold text-slate-700">{months[selectedMonth]} {selectedYear}</span>
            <button className="bg-transparent text-slate-600 hover:text-slate-900" onClick={() => setSelectedMonth((m) => (m === 11 ? 0 : m + 1))}>›</button>
            <select className="rounded-lg border border-slate-200 bg-white text-sm" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {[selectedYear - 2, selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>

          <small className="text-slate-500">{sessionUser.role}</small>
        </header>

        {errorMessage && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">{errorMessage}</p>}

        {activeTab === 'book' && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <article className={cardBase}><div className="flex justify-between"><p className="text-xs font-medium text-slate-500">Saldo Atual</p><span className="p-2 rounded-full bg-sky-50 text-sky-600"><Wallet size={16} /></span></div><p className="text-2xl font-bold tracking-tight mt-2">R$ {balance.toFixed(2)}</p></article>
              <article className={cardBase}><div className="flex justify-between"><p className="text-xs font-medium text-slate-500">Receitas</p><span className="p-2 rounded-full bg-emerald-50 text-emerald-600"><TrendingUp size={16} /></span></div><p className="text-2xl font-bold tracking-tight mt-2 text-emerald-600">R$ {totals.income.toFixed(2)}</p></article>
              <article className={cardBase}><div className="flex justify-between"><p className="text-xs font-medium text-slate-500">Despesas</p><span className="p-2 rounded-full bg-rose-50 text-rose-500"><TrendingDown size={16} /></span></div><p className="text-2xl font-bold tracking-tight mt-2 text-rose-500">R$ {totals.expense.toFixed(2)}</p></article>
              <article className={`${cardBase} ring-2 ring-emerald-100`}><div className="flex justify-between"><p className="text-xs font-medium text-slate-500">Balanço Mensal</p><span className={`px-2 py-1 text-xs rounded-full ${balance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{balance >= 0 ? 'Positivo' : 'Negativo'}</span></div><p className="text-3xl font-bold tracking-tight mt-2">R$ {balance.toFixed(2)}</p></article>
            </section>

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <input className={fieldClass} placeholder="Buscar descrição" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className={fieldClass} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">Todas categorias</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={fieldClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">Receitas e despesas</option>
                  <option value="income">Apenas receitas</option>
                  <option value="expense">Apenas despesas</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <th className="py-3 text-left">Data</th>
                      <th className="py-3 text-left">Descrição</th>
                      <th className="py-3 text-left">Categoria</th>
                      <th className="py-3 text-left hidden md:table-cell">Conta</th>
                      <th className="py-3 text-left">Valor</th>
                      <th className="py-3 text-left hidden lg:table-cell">Timestamp</th>
                      <th className="py-3 text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const category = categories.find((c) => c.id === tx.category_id)?.name || 'Sem categoria';
                      const account = accounts.find((a) => a.id === tx.account_id)?.name || '-';
                      const dateMobile = new Date(tx.effective_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      return (
                        <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-all duration-300">
                          <td className="py-3">{dateMobile}</td>
                          <td className="py-3 font-medium text-slate-700">{tx.description}</td>
                          <td className="py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{category}</span></td>
                          <td className="py-3 hidden md:table-cell text-slate-500">{account}</td>
                          <td className={`py-3 font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>R$ {Number(tx.amount).toFixed(2)}</td>
                          <td className="py-3 hidden lg:table-cell text-slate-400">{new Date(tx.created_at).toLocaleString('pt-BR')}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <button className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-all duration-300" onClick={() => openEditTransaction(tx)}><Pencil size={15} /></button>
                              <button className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-300" onClick={() => deleteTransaction(tx.id)}><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {activeTab === 'categories' && <section className="grid grid-cols-1 lg:grid-cols-2 gap-4"><article className="bg-white rounded-2xl border border-slate-100 p-4"><h2 className="font-bold text-lg mb-3">Nova categoria</h2><form className="grid gap-3" onSubmit={createCategory}><input className={fieldClass} placeholder="Nome" required value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} /><select className={fieldClass} value={categoryForm.type} onChange={(e) => setCategoryForm((p) => ({ ...p, type: e.target.value }))}><option value="expense">Despesa</option><option value="income">Receita</option></select><button>Adicionar</button></form></article><article className="bg-white rounded-2xl border border-slate-100 p-4"><h2 className="font-bold text-lg mb-3">Categorias</h2><ul className="space-y-2">{categories.map((cat) => <li key={cat.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2"><span>{cat.name}</span><button className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-300" onClick={() => deleteCategory(cat.id)}><Trash2 size={14} /></button></li>)}</ul></article></section>}

        {activeTab === 'accounts' && <section className="grid grid-cols-1 lg:grid-cols-2 gap-4"><article className="bg-white rounded-2xl border border-slate-100 p-4"><h2 className="font-bold text-lg mb-3">Nova conta</h2><form className="grid gap-3" onSubmit={createAccount}><input className={fieldClass} placeholder="Nome" required value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} /><select className={fieldClass} value={accountForm.kind} onChange={(e) => setAccountForm((p) => ({ ...p, kind: e.target.value }))}><option value="bank">Banco</option><option value="wallet">Carteira</option><option value="cash">Dinheiro</option></select><button>Adicionar</button></form></article><article className="bg-white rounded-2xl border border-slate-100 p-4"><h2 className="font-bold text-lg mb-3">Contas</h2><ul className="space-y-2">{accounts.map((acc) => <li key={acc.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2"><span>{acc.name}</span><button className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-300" onClick={() => deleteAccount(acc.id)}><Trash2 size={14} /></button></li>)}</ul></article></section>}

        {activeTab === 'users' && isMaster && <section className="grid grid-cols-1 lg:grid-cols-2 gap-4"><article className="bg-white rounded-2xl border border-slate-100 p-4"><h2 className="font-bold text-lg mb-3">Novo usuário</h2><form className="grid gap-3" onSubmit={createUser}><input className={fieldClass} placeholder="Login" required value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} /><input className={fieldClass} placeholder="Senha" required value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} /><select className={fieldClass} value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}><option value="member">Membro</option><option value="master">Master</option></select><button>Criar</button></form></article><article className="bg-white rounded-2xl border border-slate-100 p-4"><h2 className="font-bold text-lg mb-3">CRUD usuários</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs uppercase text-slate-500 border-b border-slate-100"><th className="py-2 text-left">Login</th><th className="py-2 text-left">Perfil</th><th className="py-2 text-left">Ações</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-slate-100"><td className="py-2">{user.username}</td><td className="py-2">{user.role}</td><td className="py-2"><div className="flex gap-2"><button className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-all duration-300" onClick={() => startEditUser(user)}><Pencil size={14} /></button><button className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all duration-300" onClick={() => deleteUser(user.id)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>{editingUserId && <div className="grid gap-3 mt-3 p-4 rounded-xl border border-slate-100 bg-slate-50"><input className={fieldClass} value={editingUser.username} onChange={(e) => setEditingUser((p) => ({ ...p, username: e.target.value }))} /><input className={fieldClass} value={editingUser.password} onChange={(e) => setEditingUser((p) => ({ ...p, password: e.target.value }))} /><select className={fieldClass} value={editingUser.role} onChange={(e) => setEditingUser((p) => ({ ...p, role: e.target.value }))}><option value="member">Membro</option><option value="master">Master</option></select><div className="flex gap-2"><button onClick={saveUserEdit}>Salvar</button><button className="bg-rose-500 text-white" onClick={() => setEditingUserId('')}>Cancelar</button></div></div>}</article></section>}

        {activeTab === 'profile' && <section className="bg-white rounded-2xl border border-slate-100 p-4 max-w-xl"><h2 className="text-lg font-bold mb-3">Meu perfil</h2><form className="grid gap-3" onSubmit={updateProfile}><input className={fieldClass} value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} /><input className={fieldClass} type="password" value={profile.password} onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))} /><button>Salvar</button></form></section>}

        <button className="fixed bottom-5 right-5 w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white grid place-items-center hover:scale-105 transition-all duration-300" onClick={openCreateTransaction}><Plus size={26} /></button>
      </section>

      {isTxModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-[60] grid place-items-center p-4" onClick={() => setIsTxModalOpen(false)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-7 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold tracking-tight mb-5">{txForm.id ? 'Editar transação' : 'Nova transação'}</h2>
            <form className="grid gap-4" onSubmit={saveTransaction}>
              <input className={fieldClass} placeholder="Descrição" value={txForm.description} onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))} required />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={fieldClass} type="number" step="0.01" placeholder="Valor" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))} required />
                <input className={fieldClass} type="date" value={txForm.effective_date} onChange={(e) => setTxForm((p) => ({ ...p, effective_date: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select className={fieldClass} value={txForm.type} onChange={(e) => setTxForm((p) => ({ ...p, type: e.target.value }))}><option value="income">Receita</option><option value="expense">Despesa</option></select>
                <select className={fieldClass} value={txForm.category_id} onChange={(e) => setTxForm((p) => ({ ...p, category_id: e.target.value }))} required><option value="">Categoria</option>{categories.filter((c) => c.type === txForm.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className={fieldClass} value={txForm.account_id} onChange={(e) => setTxForm((p) => ({ ...p, account_id: e.target.value }))} required><option value="">Conta</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" className="bg-slate-100 text-slate-700 rounded-xl px-5 py-2.5" onClick={() => setIsTxModalOpen(false)}>Cancelar</button>
                <button type="submit" className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl px-5 py-2.5">Salvar transação</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

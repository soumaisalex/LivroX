import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

const tabs = [
  { id: 'book', label: 'Transações' },
  { id: 'categories', label: 'Categorias' },
  { id: 'accounts', label: 'Contas' },
  { id: 'users', label: 'Usuários' },
  { id: 'profile', label: 'Perfil' }
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
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
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
    if (company?.id && setupDone && loggedIn) {
      loadTransactions();
    }
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
    if (error) {
      setErrorMessage(`Erro ao carregar transações: ${error.message}`);
      return;
    }
    setTransactions(data ?? []);
  }

  async function runSetup(e) {
    e.preventDefault();
    setErrorMessage('');

    try {
      const accountsInput = setupForm.accountsText.split('\n').map((v) => v.trim()).filter(Boolean);
      const incomeInput = setupForm.incomeText.split('\n').map((v) => v.trim()).filter(Boolean);
      const expenseInput = setupForm.expenseText.split('\n').map((v) => v.trim()).filter(Boolean);

      const { data: insertedCompany, error: companyInsertError } = await supabase
        .from('companies')
        .insert({ name: setupForm.companyName })
        .select('*')
        .single();
      if (companyInsertError) throw companyInsertError;

      const companyId = insertedCompany.id;
      const masterUserId = crypto.randomUUID();
      const { error: masterUserError } = await supabase.from('app_users').insert({
        id: masterUserId,
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

      setSessionUser({ id: masterUserId, username: 'master', role: 'master', company_id: companyId });
      setLoggedIn(true);
      setSetupDone(true);
      await bootstrap();
    } catch (error) {
      setErrorMessage(`Erro ao finalizar configuração: ${error?.message || 'erro desconhecido'}`);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMessage('');

    const { data, error } = await supabase.from('app_users').select('*').eq('company_id', company.id).eq('username', loginForm.username).limit(1);
    if (error) {
      setErrorMessage(`Erro no login: ${error.message}`);
      return;
    }

    const user = data?.[0];
    if (!user || user.password !== loginForm.password) {
      setErrorMessage('Login ou senha inválidos.');
      return;
    }

    setSessionUser({ id: user.id, username: user.username, role: user.role, company_id: user.company_id });
    setProfile({ username: user.username, password: '' });
    setLoggedIn(true);
    setLoginForm({ username: '', password: '' });
  }

  function handleLogout() {
    setLoggedIn(false);
    setActiveTab('book');
    setSessionUser({ id: '', username: '', role: 'member', company_id: company?.id ?? null });
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
      if (error) {
        setErrorMessage(`Erro ao editar transação: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from('transactions').insert({ ...payload, created_by: sessionUser.id });
      if (error) {
        setErrorMessage(`Erro ao criar transação: ${error.message}`);
        return;
      }
    }

    setIsTxModalOpen(false);
    setTxForm(emptyTransaction);
    await loadTransactions();
  }

  async function deleteTransaction(id) {
    if (!confirm('Confirma exclusão desta transação?')) return;

    const { error } = await supabase
      .from('transactions')
      .update({ deleted: true, deleted_by: sessionUser.id, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      setErrorMessage(`Erro ao excluir transação: ${error.message}`);
      return;
    }

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
    setEditingUser({ username: '', role: 'member', password: '' });
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
    setSessionUser((p) => ({ ...p, username: payload.username }));
    alert('Perfil atualizado.');
    await bootstrap();
  }

  const totals = useMemo(
    () =>
      transactions.reduce(
        (acc, tx) => {
          if (tx.type === 'income') acc.income += Number(tx.amount);
          else acc.expense += Number(tx.amount);
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [transactions]
  );

  if (loading) return <main className="center">Carregando...</main>;

  if (!setupDone) {
    return (
      <main className="page auth-page">
        <section className="card auth-card">
          <h1>Primeiro acesso • LivroX</h1>
          <form className="grid" onSubmit={runSetup}>
            <label>Empresa<input required value={setupForm.companyName} onChange={(e) => setSetupForm((p) => ({ ...p, companyName: e.target.value }))} /></label>
            <label>Bancos / Carteiras<textarea rows={4} value={setupForm.accountsText} onChange={(e) => setSetupForm((p) => ({ ...p, accountsText: e.target.value }))} /></label>
            <label>Receitas<textarea rows={4} value={setupForm.incomeText} onChange={(e) => setSetupForm((p) => ({ ...p, incomeText: e.target.value }))} /></label>
            <label>Despesas<textarea rows={4} value={setupForm.expenseText} onChange={(e) => setSetupForm((p) => ({ ...p, expenseText: e.target.value }))} /></label>
            <button type="submit">Finalizar configuração</button>
          </form>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="page auth-page">
        <section className="card auth-card">
          <h1>Entrar no LivroX</h1>
          <form className="grid" onSubmit={handleLogin}>
            <label>Login<input required value={loginForm.username} onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))} /></label>
            <label>Senha<input type="password" required value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} /></label>
            <button type="submit">Entrar</button>
          </form>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h2>LivroX</h2>
        <p className="company-name">{company?.name}</p>
        {tabs.map((tab) => (
          <button key={tab.id} className={`side-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}>
            {tab.label}
          </button>
        ))}
        <button className="side-btn" onClick={handleLogout}>Sair</button>
      </aside>

      <section className="main-content">
        <header className="topbar card">
          <div className="mobile-row">
            <button className="menu-toggle" onClick={() => setSidebarOpen((v) => !v)}>☰</button>
            <h1>Transações</h1>
          </div>

          <div className="month-selector">
            <button onClick={() => setSelectedMonth((m) => (m === 0 ? 11 : m - 1))}>‹</button>
            <strong>{months[selectedMonth]} {selectedYear}</strong>
            <button onClick={() => setSelectedMonth((m) => (m === 11 ? 0 : m + 1))}>›</button>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {[selectedYear - 2, selectedYear - 1, selectedYear, selectedYear + 1].map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>

          <small>{sessionUser.username} ({sessionUser.role})</small>
        </header>

        {errorMessage && <p className="error-text">{errorMessage}</p>}

        {activeTab === 'book' && (
          <section className="card">
            <div className="kpi-grid">
              <article className="kpi-card"><small>Saldo atual</small><strong>R$ {(totals.income - totals.expense).toFixed(2)}</strong></article>
              <article className="kpi-card"><small>Receitas</small><strong className="amount income">R$ {totals.income.toFixed(2)}</strong></article>
              <article className="kpi-card"><small>Despesas</small><strong className="amount expense">R$ {totals.expense.toFixed(2)}</strong></article>
              <article className="kpi-card"><small>Balanço mensal</small><strong>R$ {(totals.income - totals.expense).toFixed(2)}</strong></article>
            </div>

            <div className="filters">
              <input placeholder="Buscar descrição" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Todas categorias</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Receitas e despesas</option>
                <option value="income">Apenas receitas</option>
                <option value="expense">Apenas despesas</option>
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Valor</th><th className="desktop-only">Timestamp</th><th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="mobile-date">{new Date(tx.effective_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                      <td>{tx.description}</td>
                      <td>{categories.find((c) => c.id === tx.category_id)?.name || '-'}</td>
                      <td>{accounts.find((a) => a.id === tx.account_id)?.name || '-'}</td>
                      <td className={`amount ${tx.type === 'income' ? 'income' : 'expense'}`}>R$ {Number(tx.amount).toFixed(2)}</td>
                      <td className="desktop-only">{new Date(tx.created_at).toLocaleString('pt-BR')}</td>
                      <td className="actions-row">
                        <button className="icon-btn" onClick={() => openEditTransaction(tx)} title="Editar">✏️</button>
                        <button className="icon-btn danger" onClick={() => deleteTransaction(tx.id)} title="Excluir">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'categories' && (
          <section className="grid-2">
            <article className="card"><h2>Nova categoria</h2><form className="grid" onSubmit={createCategory}><label>Nome<input required value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} /></label><label>Tipo<select value={categoryForm.type} onChange={(e) => setCategoryForm((p) => ({ ...p, type: e.target.value }))}><option value="expense">Despesa</option><option value="income">Receita</option></select></label><button type="submit">Adicionar</button></form></article>
            <article className="card"><h2>Categorias</h2><ul className="list">{categories.map((cat) => <li key={cat.id}><span>{cat.name} ({cat.type})</span><button className="icon-btn danger" onClick={() => deleteCategory(cat.id)}>🗑️</button></li>)}</ul></article>
          </section>
        )}

        {activeTab === 'accounts' && (
          <section className="grid-2">
            <article className="card"><h2>Nova conta</h2><form className="grid" onSubmit={createAccount}><label>Nome<input required value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} /></label><label>Tipo<select value={accountForm.kind} onChange={(e) => setAccountForm((p) => ({ ...p, kind: e.target.value }))}><option value="bank">Banco</option><option value="wallet">Carteira</option><option value="cash">Dinheiro</option></select></label><button type="submit">Adicionar</button></form></article>
            <article className="card"><h2>Contas</h2><ul className="list">{accounts.map((acc) => <li key={acc.id}><span>{acc.name} ({acc.kind})</span><button className="icon-btn danger" onClick={() => deleteAccount(acc.id)}>🗑️</button></li>)}</ul></article>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="grid-2">
            <article className="card"><h2>Novo usuário</h2><form className="grid" onSubmit={createUser}><label>Login<input required value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} /></label><label>Senha<input required value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} /></label><label>Perfil<select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}><option value="member">Membro</option><option value="master">Master</option></select></label><button type="submit">Criar</button></form></article>
            <article className="card"><h2>CRUD de usuários</h2><div className="table-wrap"><table><thead><tr><th>Login</th><th>Perfil</th><th>Ações</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.username}</td><td>{user.role}</td><td className="actions-row"><button className="icon-btn" onClick={() => startEditUser(user)}>✏️</button><button className="icon-btn danger" onClick={() => deleteUser(user.id)}>🗑️</button></td></tr>)}</tbody></table></div>{editingUserId && <div className="edit-box grid"><label>Login<input value={editingUser.username} onChange={(e) => setEditingUser((p) => ({ ...p, username: e.target.value }))} /></label><label>Perfil<select value={editingUser.role} onChange={(e) => setEditingUser((p) => ({ ...p, role: e.target.value }))}><option value="member">Membro</option><option value="master">Master</option></select></label><label>Senha<input value={editingUser.password} onChange={(e) => setEditingUser((p) => ({ ...p, password: e.target.value }))} /></label><div className="actions-row"><button onClick={saveUserEdit}>Salvar</button><button className="danger" onClick={() => setEditingUserId('')}>Cancelar</button></div></div>}</article>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="card"><h2>Meu perfil</h2><form className="grid" onSubmit={updateProfile}><label>Login<input required value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} /></label><label>Nova senha<input type="password" required value={profile.password} onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))} /></label><button type="submit">Salvar</button></form></section>
        )}

        <button className="fab" onClick={openCreateTransaction}>＋</button>
      </section>

      {isTxModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsTxModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>{txForm.id ? 'Editar transação' : 'Nova transação'}</h2>
            <form className="grid" onSubmit={saveTransaction}>
              <label>Descrição<input value={txForm.description} onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))} required /></label>
              <label>Valor<input type="number" step="0.01" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))} required /></label>
              <label>Data<input type="date" value={txForm.effective_date} onChange={(e) => setTxForm((p) => ({ ...p, effective_date: e.target.value }))} required /></label>
              <label>Tipo<select value={txForm.type} onChange={(e) => setTxForm((p) => ({ ...p, type: e.target.value }))}><option value="income">Receita</option><option value="expense">Despesa</option></select></label>
              <label>Categoria<select value={txForm.category_id} onChange={(e) => setTxForm((p) => ({ ...p, category_id: e.target.value }))} required><option value="">Selecione</option>{categories.filter((c) => c.type === txForm.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Conta<select value={txForm.account_id} onChange={(e) => setTxForm((p) => ({ ...p, account_id: e.target.value }))} required><option value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <div className="actions-row"><button type="submit">Salvar</button><button className="danger" type="button" onClick={() => setIsTxModalOpen(false)}>Cancelar</button></div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

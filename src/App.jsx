import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

const tabs = [
  { id: 'book', label: 'Livro-caixa' },
  { id: 'categories', label: 'Categorias' },
  { id: 'accounts', label: 'Contas' },
  { id: 'users', label: 'Usuários' },
  { id: 'profile', label: 'Meu perfil' }
];

const emptyTransaction = {
  description: '',
  amount: '',
  effective_date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  category_id: '',
  account_id: ''
};

export default function App() {
  const [activeTab, setActiveTab] = useState('book');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const [company, setCompany] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const [sessionUser, setSessionUser] = useState({
    id: '',
    username: '',
    role: 'member',
    company_id: null
  });

  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

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

      const [onboardingRes, accountsRes, categoriesRes, txRes, usersRes] = await Promise.all([
        supabase.from('company_onboarding').select('*').eq('company_id', companyData.id).limit(1),
        supabase.from('accounts').select('*').eq('company_id', companyData.id).order('name'),
        supabase.from('categories').select('*').eq('company_id', companyData.id).order('name'),
        supabase.from('transactions').select('*').eq('company_id', companyData.id).order('created_at', { ascending: false }),
        supabase.from('app_users').select('*').eq('company_id', companyData.id).order('created_at', { ascending: false })
      ]);

      const queryErrors = [onboardingRes.error, accountsRes.error, categoriesRes.error, txRes.error, usersRes.error].filter(Boolean);
      if (queryErrors.length) throw queryErrors[0];

      setSetupDone(onboardingRes.data?.[0]?.completed ?? false);
      setAccounts(accountsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setTransactions(txRes.data ?? []);
      setUsers(usersRes.data ?? []);
    } catch (error) {
      setErrorMessage(`Erro ao carregar dados: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
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
      setCompany(insertedCompany);

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
        const { error: accountsError } = await supabase.from('accounts').insert(
          accountsInput.map((name) => ({ company_id: companyId, name, kind: 'bank' }))
        );
        if (accountsError) throw accountsError;
      }

      if (incomeInput.length) {
        const { error: incomeCategoriesError } = await supabase.from('categories').insert(
          incomeInput.map((name) => ({ company_id: companyId, name, type: 'income' }))
        );
        if (incomeCategoriesError) throw incomeCategoriesError;
      }

      if (expenseInput.length) {
        const { error: expenseCategoriesError } = await supabase.from('categories').insert(
          expenseInput.map((name) => ({ company_id: companyId, name, type: 'expense' }))
        );
        if (expenseCategoriesError) throw expenseCategoriesError;
      }

      const { error: onboardingError } = await supabase
        .from('company_onboarding')
        .upsert({ company_id: companyId, completed: true, completed_at: new Date().toISOString() });
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
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('company_id', company.id)
      .eq('username', loginForm.username)
      .limit(1);

    if (error) {
      setErrorMessage(`Erro no login: ${error.message}`);
      return;
    }

    const user = data?.[0];
    if (!user || !loginForm.password.trim()) {
      setErrorMessage('Login inválido.');
      return;
    }

    if (user.password !== loginForm.password) {
      setErrorMessage('Senha incorreta.');
      return;
    }

    setSessionUser({ id: user.id, username: user.username, role: user.role, company_id: user.company_id });
    setProfile((prev) => ({ ...prev, username: user.username }));
    setLoggedIn(true);
    setLoginForm({ username: '', password: '' });
  }

  function handleLogout() {
    setLoggedIn(false);
    setSessionUser({ id: '', username: '', role: 'member', company_id: company?.id ?? null });
    setActiveTab('book');
  }

  async function createTransaction(e) {
    e.preventDefault();
    if (!company?.id || !sessionUser.id) return;

    const { error } = await supabase.from('transactions').insert({
      ...txForm,
      company_id: company.id,
      amount: Number(txForm.amount),
      created_by: sessionUser.id
    });

    if (error) {
      setErrorMessage(`Erro ao salvar transação: ${error.message}`);
      return;
    }

    setTxForm(emptyTransaction);
    setIsTxModalOpen(false);
    await bootstrap();
  }

  async function deleteTransaction(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      setErrorMessage(`Erro ao excluir transação: ${error.message}`);
      return;
    }
    await bootstrap();
  }

  async function createCategory(e) {
    e.preventDefault();
    const { error } = await supabase.from('categories').insert({
      company_id: company.id,
      name: categoryForm.name,
      type: categoryForm.type
    });
    if (error) {
      setErrorMessage(`Erro ao criar categoria: ${error.message}`);
      return;
    }
    setCategoryForm({ name: '', type: 'expense' });
    await bootstrap();
  }

  async function deleteCategory(id) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      setErrorMessage(`Erro ao excluir categoria: ${error.message}`);
      return;
    }
    await bootstrap();
  }

  async function createAccount(e) {
    e.preventDefault();
    const { error } = await supabase.from('accounts').insert({
      company_id: company.id,
      name: accountForm.name,
      kind: accountForm.kind
    });
    if (error) {
      setErrorMessage(`Erro ao criar conta: ${error.message}`);
      return;
    }
    setAccountForm({ name: '', kind: 'bank' });
    await bootstrap();
  }

  async function deleteAccount(id) {
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) {
      setErrorMessage(`Erro ao excluir conta: ${error.message}`);
      return;
    }
    await bootstrap();
  }

  async function createUser(e) {
    e.preventDefault();
    if (sessionUser.role !== 'master') return;

    const { error } = await supabase.from('app_users').insert({
      id: crypto.randomUUID(),
      company_id: company.id,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role
    });
    if (error) {
      setErrorMessage(`Erro ao criar usuário: ${error.message}`);
      return;
    }

    setNewUser({ username: '', password: '', role: 'member' });
    await bootstrap();
  }

  async function updateProfile(e) {
    e.preventDefault();
    if (!sessionUser.id) return;

    const payload = { username: profile.username };
    if (profile.password.trim()) {
      payload.password = profile.password;
    }

    const { error } = await supabase.from('app_users').update(payload).eq('id', sessionUser.id);
    if (error) {
      setErrorMessage(`Erro ao atualizar perfil: ${error.message}`);
      return;
    }

    setSessionUser((prev) => ({ ...prev, username: profile.username }));
    setProfile((prev) => ({ ...prev, password: '' }));
    alert('Perfil atualizado.');
    await bootstrap();
  }

  function startEditUser(user) {
    setEditingUserId(user.id);
    setEditingUser({ username: user.username, role: user.role, password: '' });
  }

  async function saveUserEdit() {
    const payload = { username: editingUser.username, role: editingUser.role };
    if (editingUser.password.trim()) payload.password = editingUser.password;

    const { error } = await supabase.from('app_users').update(payload).eq('id', editingUserId);
    if (error) {
      setErrorMessage(`Erro ao atualizar usuário: ${error.message}`);
      return;
    }
    setEditingUserId('');
    setEditingUser({ username: '', role: 'member', password: '' });
    await bootstrap();
  }

  async function deleteUser(id) {
    if (id === sessionUser.id) {
      setErrorMessage('Você não pode excluir o usuário logado.');
      return;
    }
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) {
      setErrorMessage(`Erro ao excluir usuário: ${error.message}`);
      return;
    }
    await bootstrap();
  }

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const matchesText = !search || (tx.description || '').toLowerCase().includes(search.toLowerCase());
        const matchesStart = !dateStart || tx.effective_date >= dateStart;
        const matchesEnd = !dateEnd || tx.effective_date <= dateEnd;
        const matchesCategory = !categoryFilter || tx.category_id === categoryFilter;
        return matchesText && matchesStart && matchesEnd && matchesCategory;
      }),
    [transactions, search, dateStart, dateEnd, categoryFilter]
  );

  const totals = useMemo(
    () =>
      filteredTransactions.reduce(
        (acc, tx) => {
          if (tx.type === 'income') acc.income += Number(tx.amount);
          else acc.expense += Number(tx.amount);
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [filteredTransactions]
  );

  if (loading) return <main className="center">Carregando dados...</main>;

  if (errorMessage && !setupDone) {
    return (
      <main className="page">
        <section className="card">
          <h1>Não foi possível carregar o app</h1>
          <p className="error-text">{errorMessage}</p>
          <button onClick={bootstrap}>Tentar novamente</button>
        </section>
      </main>
    );
  }

  if (!setupDone) {
    return (
      <main className="page">
        <section className="card setup-card">
          <h1>Primeiro acesso • LivroX</h1>
          <p>Cadastre empresa, bancos/carteiras e categorias iniciais do livro-caixa.</p>
          <form className="grid" onSubmit={runSetup}>
            <label>Empresa<input required value={setupForm.companyName} onChange={(e) => setSetupForm((p) => ({ ...p, companyName: e.target.value }))} /></label>
            <label>Bancos / Carteiras (1 por linha)<textarea rows={4} value={setupForm.accountsText} onChange={(e) => setSetupForm((p) => ({ ...p, accountsText: e.target.value }))} /></label>
            <label>Categorias de receita (1 por linha)<textarea rows={4} value={setupForm.incomeText} onChange={(e) => setSetupForm((p) => ({ ...p, incomeText: e.target.value }))} /></label>
            <label>Categorias de despesa (1 por linha)<textarea rows={4} value={setupForm.expenseText} onChange={(e) => setSetupForm((p) => ({ ...p, expenseText: e.target.value }))} /></label>
            <button type="submit">Finalizar configuração</button>
          </form>
          {errorMessage && <p className="error-text">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  if (!loggedIn) {
    return (
      <main className="page">
        <section className="card setup-card">
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
    <main className="page">
      <header className="topbar card">
        <div>
          <h1>{company?.name || 'LivroX'}</h1>
          <small>{sessionUser.username} • perfil {sessionUser.role}</small>
        </div>
        <nav>
          {tabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>
          ))}
          <button onClick={handleLogout}>Sair</button>
        </nav>
      </header>

      {errorMessage && <p className="error-text">{errorMessage}</p>}

      {activeTab === 'book' && (
        <section className="card">
          <div className="section-head">
            <h2>Transações</h2>
            <button onClick={() => setIsTxModalOpen(true)}>+ Nova transação</button>
          </div>

          <div className="filters">
            <input placeholder="Buscar descrição..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Todas categorias</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="kpi-grid">
            <article className="kpi-card"><small>Saldo atual</small><strong>R$ {(totals.income - totals.expense).toFixed(2)}</strong></article>
            <article className="kpi-card"><small>Receitas</small><strong>R$ {totals.income.toFixed(2)}</strong></article>
            <article className="kpi-card"><small>Despesas</small><strong>R$ {totals.expense.toFixed(2)}</strong></article>
            <article className="kpi-card"><small>Balanço mensal</small><strong>R$ {(totals.income - totals.expense).toFixed(2)}</strong></article>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th><th>Tipo</th><th>Valor</th><th>Data</th><th>Timestamp</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.description}</td>
                    <td>{tx.type === 'income' ? 'Receita' : 'Despesa'}</td>
                    <td>R$ {Number(tx.amount).toFixed(2)}</td>
                    <td>{tx.effective_date}</td>
                    <td>{new Date(tx.created_at).toLocaleString('pt-BR')}</td>
                    <td><button className="danger" onClick={() => deleteTransaction(tx.id)}>Excluir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'categories' && (
        <section className="grid-2">
          <article className="card">
            <h2>Nova categoria</h2>
            <form className="grid" onSubmit={createCategory}>
              <label>Nome<input required value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Tipo<select value={categoryForm.type} onChange={(e) => setCategoryForm((p) => ({ ...p, type: e.target.value }))}><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
              <button type="submit">Adicionar categoria</button>
            </form>
          </article>
          <article className="card">
            <h2>Categorias cadastradas</h2>
            <ul className="list">
              {categories.map((cat) => (
                <li key={cat.id}><span>{cat.name} ({cat.type})</span><button className="danger" onClick={() => deleteCategory(cat.id)}>Excluir</button></li>
              ))}
            </ul>
          </article>
        </section>
      )}

      {activeTab === 'accounts' && (
        <section className="grid-2">
          <article className="card">
            <h2>Nova conta</h2>
            <form className="grid" onSubmit={createAccount}>
              <label>Nome<input required value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} /></label>
              <label>Tipo<select value={accountForm.kind} onChange={(e) => setAccountForm((p) => ({ ...p, kind: e.target.value }))}><option value="bank">Banco</option><option value="wallet">Carteira</option><option value="cash">Dinheiro</option></select></label>
              <button type="submit">Adicionar conta</button>
            </form>
          </article>
          <article className="card">
            <h2>Contas cadastradas</h2>
            <ul className="list">
              {accounts.map((acc) => (
                <li key={acc.id}><span>{acc.name} ({acc.kind})</span><button className="danger" onClick={() => deleteAccount(acc.id)}>Excluir</button></li>
              ))}
            </ul>
          </article>
        </section>
      )}

      {activeTab === 'users' && (
        <section className="grid-2">
          <article className="card">
            <h2>Novo usuário (master)</h2>
            <form className="grid" onSubmit={createUser}>
              <label>Login<input required value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} /></label>
              <label>Senha temporária<input required value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} /></label>
              <label>Perfil<select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}><option value="member">Membro</option><option value="master">Master</option></select></label>
              <button type="submit">Criar usuário</button>
            </form>
            <p className="tip">Senha é salva em texto para facilitar recuperação (conforme solicitado).</p>
          </article>

          <article className="card">
          <h2>Gerenciamento de usuários (CRUD)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Login</th><th>Perfil</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td>{user.is_active ? 'Ativo' : 'Inativo'}</td>
                    <td className="actions-row">
                      <button onClick={() => startEditUser(user)}>Editar</button>
                      <button className="danger" onClick={() => deleteUser(user.id)}>Excluir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingUserId && (
            <div className="grid edit-box">
              <h3>Editar usuário</h3>
              <label>Login<input value={editingUser.username} onChange={(e) => setEditingUser((p) => ({ ...p, username: e.target.value }))} /></label>
              <label>Perfil<select value={editingUser.role} onChange={(e) => setEditingUser((p) => ({ ...p, role: e.target.value }))}><option value="member">Membro</option><option value="master">Master</option></select></label>
              <label>Nova senha (opcional)<input type="password" value={editingUser.password} onChange={(e) => setEditingUser((p) => ({ ...p, password: e.target.value }))} /></label>
              <div className="actions-row">
                <button onClick={saveUserEdit}>Salvar</button>
                <button className="danger" onClick={() => setEditingUserId('')}>Cancelar</button>
              </div>
            </div>
          )}
          </article>
        </section>
      )}

      {activeTab === 'profile' && (
        <section className="card">
          <h2>Meu perfil</h2>
          <form className="grid profile" onSubmit={updateProfile}>
            <label>Login<input required value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} /></label>
            <label>Nova senha<input type="password" required value={profile.password} onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))} /></label>
            <button type="submit">Salvar alterações</button>
          </form>
        </section>
      )}

      {isTxModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsTxModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="section-head">
              <h2>Nova transação</h2>
              <button onClick={() => setIsTxModalOpen(false)}>Fechar</button>
            </div>
            <form className="grid" onSubmit={createTransaction}>
              <label>Descrição<input value={txForm.description} onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))} required /></label>
              <label>Valor<input type="number" step="0.01" min="0" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))} required /></label>
              <label>Data efetiva<input type="date" value={txForm.effective_date} onChange={(e) => setTxForm((p) => ({ ...p, effective_date: e.target.value }))} required /></label>
              <label>Tipo<select value={txForm.type} onChange={(e) => setTxForm((p) => ({ ...p, type: e.target.value, category_id: '' }))}><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
              <label>Categoria<select value={txForm.category_id} onChange={(e) => setTxForm((p) => ({ ...p, category_id: e.target.value }))} required><option value="">Selecione</option>{categories.filter((c) => c.type === txForm.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Conta<select value={txForm.account_id} onChange={(e) => setTxForm((p) => ({ ...p, account_id: e.target.value }))} required><option value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
              <button type="submit">Salvar transação</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

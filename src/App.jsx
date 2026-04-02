import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

const tabs = [
  { id: 'book', label: 'Livro-caixa' },
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
  const [sessionUser, setSessionUser] = useState({
    id: 'demo-master',
    username: 'master',
    role: 'master',
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

  const [setupForm, setSetupForm] = useState({
    companyName: '',
    accountsText: 'Banco do Brasil\nDinheiro\nSantander',
    incomeText: 'Vendas\nServiços',
    expenseText: 'Aluguel\nFornecedores'
  });

  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'member' });
  const [profile, setProfile] = useState({ username: 'master', password: '' });

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
      setSessionUser((prev) => ({ ...prev, company_id: companyData.id }));

      const [onboardingRes, accountsRes, categoriesRes, txRes, usersRes] = await Promise.all([
        supabase.from('company_onboarding').select('*').eq('company_id', companyData.id).limit(1),
        supabase.from('accounts').select('*').eq('company_id', companyData.id).order('name'),
        supabase.from('categories').select('*').eq('company_id', companyData.id).order('name'),
        supabase.from('transactions').select('*').eq('company_id', companyData.id).order('created_at', { ascending: false }),
        supabase.from('app_users').select('*').eq('company_id', companyData.id).order('created_at', { ascending: false })
      ]);

      const queryErrors = [onboardingRes.error, accountsRes.error, categoriesRes.error, txRes.error, usersRes.error].filter(Boolean);
      if (queryErrors.length) {
        throw queryErrors[0];
      }

      setSetupDone(onboardingRes.data?.[0]?.completed ?? false);
      setAccounts(accountsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setTransactions(txRes.data ?? []);
      setUsers(usersRes.data ?? []);
    } catch (error) {
      setErrorMessage(
        `Erro ao carregar dados do Supabase: ${error?.message || 'erro desconhecido'}. ` +
        'Confirme as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Netlify.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function runSetup(e) {
    e.preventDefault();
    const accountsInput = setupForm.accountsText.split('\n').map((v) => v.trim()).filter(Boolean);
    const incomeInput = setupForm.incomeText.split('\n').map((v) => v.trim()).filter(Boolean);
    const expenseInput = setupForm.expenseText.split('\n').map((v) => v.trim()).filter(Boolean);

    let companyId = company?.id;
    if (!companyId) {
      const { data: insertedCompany } = await supabase
        .from('companies')
        .insert({ name: setupForm.companyName })
        .select('*')
        .single();
      companyId = insertedCompany.id;
      setCompany(insertedCompany);
      setSessionUser((prev) => ({ ...prev, company_id: companyId }));
    }

    if (accountsInput.length) {
      await supabase.from('accounts').insert(
        accountsInput.map((name) => ({ company_id: companyId, name, kind: 'bank' }))
      );
    }

    if (incomeInput.length) {
      await supabase.from('categories').insert(
        incomeInput.map((name) => ({ company_id: companyId, name, type: 'income' }))
      );
    }

    if (expenseInput.length) {
      await supabase.from('categories').insert(
        expenseInput.map((name) => ({ company_id: companyId, name, type: 'expense' }))
      );
    }

    await supabase
      .from('company_onboarding')
      .upsert({ company_id: companyId, completed: true, completed_at: new Date().toISOString() });

    setSetupDone(true);
    await bootstrap();
  }

  async function createTransaction(e) {
    e.preventDefault();
    if (!company?.id) return;

    await supabase.from('transactions').insert({
      ...txForm,
      company_id: company.id,
      amount: Number(txForm.amount),
      created_by: sessionUser.id
    });

    setTxForm(emptyTransaction);
    await bootstrap();
  }

  async function createUser(e) {
    e.preventDefault();
    if (!company?.id || sessionUser.role !== 'master') return;

    await supabase.from('app_users').insert({
      id: crypto.randomUUID(),
      company_id: company.id,
      username: newUser.username,
      role: newUser.role
    });

    setNewUser({ username: '', password: '', role: 'member' });
    await bootstrap();
  }

  async function updateProfile(e) {
    e.preventDefault();
    setSessionUser((prev) => ({ ...prev, username: profile.username }));
    alert('Perfil atualizado na interface. A troca de senha deve ser concluída via função segura no backend.');
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesText =
        !search || (tx.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesStart = !dateStart || tx.effective_date >= dateStart;
      const matchesEnd = !dateEnd || tx.effective_date <= dateEnd;
      const matchesCategory = !categoryFilter || tx.category_id === categoryFilter;
      return matchesText && matchesStart && matchesEnd && matchesCategory;
    });
  }, [transactions, search, dateStart, dateEnd, categoryFilter]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.type === 'income') acc.income += Number(tx.amount);
        else acc.expense += Number(tx.amount);
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [filteredTransactions]);

  if (loading) {
    return <main className="center">Carregando dados...</main>;
  }

  if (errorMessage) {
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
            <label>
              Empresa
              <input
                required
                value={setupForm.companyName}
                onChange={(e) => setSetupForm((p) => ({ ...p, companyName: e.target.value }))}
              />
            </label>
            <label>
              Bancos / Carteiras (1 por linha)
              <textarea
                rows={4}
                value={setupForm.accountsText}
                onChange={(e) => setSetupForm((p) => ({ ...p, accountsText: e.target.value }))}
              />
            </label>
            <label>
              Categorias de receita (1 por linha)
              <textarea
                rows={4}
                value={setupForm.incomeText}
                onChange={(e) => setSetupForm((p) => ({ ...p, incomeText: e.target.value }))}
              />
            </label>
            <label>
              Categorias de despesa (1 por linha)
              <textarea
                rows={4}
                value={setupForm.expenseText}
                onChange={(e) => setSetupForm((p) => ({ ...p, expenseText: e.target.value }))}
              />
            </label>
            <button type="submit">Finalizar configuração</button>
          </form>
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
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === 'book' && (
        <section className="grid-2">
          <article className="card">
            <h2>Nova transação</h2>
            <form className="grid" onSubmit={createTransaction}>
              <label>
                Descrição
                <input
                  value={txForm.description}
                  onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))}
                  required
                />
              </label>
              <label>
                Valor
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={txForm.amount}
                  onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))}
                  required
                />
              </label>
              <label>
                Data efetiva
                <input
                  type="date"
                  value={txForm.effective_date}
                  onChange={(e) => setTxForm((p) => ({ ...p, effective_date: e.target.value }))}
                  required
                />
              </label>
              <label>
                Tipo
                <select
                  value={txForm.type}
                  onChange={(e) => setTxForm((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </label>
              <label>
                Categoria
                <select
                  value={txForm.category_id}
                  onChange={(e) => setTxForm((p) => ({ ...p, category_id: e.target.value }))}
                  required
                >
                  <option value="">Selecione</option>
                  {categories
                    .filter((c) => c.type === txForm.type)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </label>
              <label>
                Conta
                <select
                  value={txForm.account_id}
                  onChange={(e) => setTxForm((p) => ({ ...p, account_id: e.target.value }))}
                  required
                >
                  <option value="">Selecione</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              <button type="submit">Salvar transação</button>
            </form>
          </article>

          <article className="card">
            <h2>Busca e filtros</h2>
            <div className="filters">
              <input
                placeholder="Buscar descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="kpis">
              <p>Receitas: <strong>R$ {totals.income.toFixed(2)}</strong></p>
              <p>Despesas: <strong>R$ {totals.expense.toFixed(2)}</strong></p>
              <p>Saldo: <strong>R$ {(totals.income - totals.expense).toFixed(2)}</strong></p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th>Data</th>
                    <th>Timestamp</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {activeTab === 'users' && (
        <section className="grid-2">
          <article className="card">
            <h2>Usuários da empresa</h2>
            <ul className="list">
              {users.map((user) => (
                <li key={user.id}>
                  <span>{user.username}</span>
                  <small>{user.role}</small>
                </li>
              ))}
            </ul>
          </article>
          <article className="card">
            <h2>Novo usuário (master)</h2>
            <form className="grid" onSubmit={createUser}>
              <label>
                Login
                <input
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                />
              </label>
              <label>
                Senha temporária
                <input
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                />
              </label>
              <label>
                Perfil
                <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
                  <option value="member">Membro</option>
                  <option value="master">Master</option>
                </select>
              </label>
              <button type="submit">Criar usuário</button>
            </form>
            <p className="tip">A persistência segura da senha deve ocorrer em Edge Function (hash + política de troca).</p>
          </article>
        </section>
      )}

      {activeTab === 'profile' && (
        <section className="card">
          <h2>Meu perfil</h2>
          <form className="grid profile" onSubmit={updateProfile}>
            <label>
              Login
              <input
                required
                value={profile.username}
                onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              />
            </label>
            <label>
              Nova senha
              <input
                type="password"
                required
                value={profile.password}
                onChange={(e) => setProfile((p) => ({ ...p, password: e.target.value }))}
              />
            </label>
            <button type="submit">Salvar alterações</button>
          </form>
        </section>
      )}
    </main>
  );
}

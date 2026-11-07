import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bell,
  BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, ChevronsUpDown, CircleHelp, Clock3, Command, Edit3, FileText,
  Filter, LayoutDashboard, MapPin, Menu, MoreVertical, Pencil, Plus, Search,
  ShieldCheck, Sparkles, Trash2, Truck, UserRound, Users, X, Zap, Mail, Phone,
  PauseCircle, RefreshCw, LogOut
} from 'lucide-react';
import { api } from './api.js';
import AuthPage from './AuthPage.jsx';

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'A';
const statusLabel = s => String(s || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'Active' : 'Inactive';
const dateLabel = value => value ? new Date(value).toLocaleString([], { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const friendlyError = e => e?.message || 'Something went wrong. Please try again.';
const getId = a => a?.id ?? a?.agentId;

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const sessionUserRef = useRef(null);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  const notify = useCallback((message, type='success') => {
    setToast({ message, type });
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const refresh = useCallback(async () => {
    const userId = user?.id;
    if (!userId || sessionUserRef.current !== userId) return;
    setLoading(true); setLoadError('');
    try {
      const data = await api.listAgents();
      if (sessionUserRef.current === userId) setAgents(data);
    }
    catch (e) { if (sessionUserRef.current === userId) setLoadError(friendlyError(e)); }
    finally { if (sessionUserRef.current === userId) setLoading(false); }
  }, [user?.id]);

  const logout = useCallback(() => {
    api.setToken(null); sessionUserRef.current = null;
    setUser(null); setAgents([]); setActivities([]); setToast(null); setLoadError(''); setMobileOpen(false);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    if (!api.getToken()) { setAuthLoading(false); return; }
    api.me().then(account => {
      if (alive) { sessionUserRef.current = account.id; setUser(account); }
    }).catch(error => {
      if (alive) { api.setToken(null); setLoadError(friendlyError(error)); }
    }).finally(() => { if (alive) setAuthLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    window.addEventListener('agent-hub-unauthorized', logout);
    return () => window.removeEventListener('agent-hub-unauthorized', logout);
  }, [logout]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const addActivity = useCallback((label, detail) => {
    setActivities(prev => [{ id: Date.now(), label, detail, time: new Date() }, ...prev].slice(0,5));
  }, []);

  const onCreated = async agent => {
    if (sessionUserRef.current !== user?.id) return;
    await refresh();
    if (sessionUserRef.current !== user?.id) return;
    addActivity('New agent added', `${agent.name} was added to the system.`); notify('Agent created successfully.');
    navigate('/agents');
  };
  const onUpdated = async agent => {
    if (sessionUserRef.current !== user?.id) return;
    await refresh();
    if (sessionUserRef.current !== user?.id) return;
    addActivity('Agent updated', `${agent.name}'s details were updated.`); notify('Agent updated successfully.');
    navigate('/agents');
  };
  const onDeleted = async agent => {
    if (sessionUserRef.current !== user?.id) return;
    await refresh();
    if (sessionUserRef.current !== user?.id) return;
    addActivity('Agent removed', `${agent.name} was removed from the system.`); notify('Agent deleted successfully.');
    navigate('/agents');
  };

  const pageTitle = location.pathname === '/' ? 'Dashboard' : location.pathname.startsWith('/agents/') ? 'Agent Details' : location.pathname === '/add-agent' ? 'Add Agent' : 'Agents';

  const authenticated = ({ token, user: account }) => {
    api.setToken(token); sessionUserRef.current = account.id;
    setAgents([]); setActivities([]); setLoadError(''); setUser(account); setAuthLoading(false);
    const from = location.state?.from;
    navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/', { replace: true });
  };

  if (authLoading) return <div className="auth-shell loading-page">Checking your session...</div>;
  if (!user) return <Routes>
    <Route path="/login" element={<AuthPage key="login" mode="login" onAuthenticated={authenticated} sessionError={loadError}/>}/>
    <Route path="/register" element={<AuthPage key="register" mode="register" onAuthenticated={authenticated}/>}/>
    <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname + location.search }}/>}/>
  </Routes>;
  if (location.pathname === '/login' || location.pathname === '/register') return <Navigate to="/" replace/>;

  return <div className="app-shell">
    <Sidebar mobileOpen={mobileOpen} close={() => setMobileOpen(false)} />
    <main className="main-area">
      <Topbar onMenu={() => setMobileOpen(v=>!v)} agents={agents} loading={loading} error={loadError} user={user} onLogout={logout} />
      <div className="page-wrap">
        <Routes>
          <Route path="/" element={<Dashboard agents={agents} loading={loading} error={loadError} activities={activities} onRetry={refresh} onAdd={() => navigate('/add-agent')} onAgents={() => navigate('/agents')} user={user} />} />
          <Route path="/agents" element={<AgentsPage agents={agents} loading={loading} error={loadError} onRetry={refresh} onAdd={() => navigate('/add-agent')} onEdit={id=>navigate(`/agents/${id}/edit`)} onView={id=>navigate(`/agents/${id}`)} onDelete={onDeleted} notify={notify} />} />
          <Route path="/add-agent" element={<AgentForm onSubmit={onCreated} notify={notify} />} />
          <Route path="/agents/:id/edit" element={<EditAgent agents={agents} refresh={refresh} onSubmit={onUpdated} notify={notify} />} />
          <Route path="/agents/:id" element={<AgentDetails agents={agents} loading={loading} onEdit={id=>navigate(`/agents/${id}/edit`)} onDelete={onDeleted} notify={notify} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <footer className="footer"><span>© {new Date().getFullYear()} Aone Tech</span><span>Agent Hub <i/> Built for smoother operations</span></footer>
    </main>
    {toast && <div className={`toast ${toast.type}`}><CheckCircle2 size={18}/>{toast.message}<button onClick={()=>setToast(null)}><X size={15}/></button></div>}
  </div>;
}

function Sidebar({ mobileOpen, close }) {
  return <>
    {mobileOpen && <button className="mobile-scrim" onClick={close} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">A</div><span>Agent Hub<small>Aone Tech</small></span></div>
      <div className="side-label">WORKSPACE</div>
      <nav className="side-nav">
        <NavLink to="/" end><LayoutDashboard/><span>Dashboard</span></NavLink>
        <NavLink to="/agents"><Users/><span>Agents</span></NavLink>
        <NavLink to="/add-agent"><Plus/><span>Add Agent</span></NavLink>
      </nav>
      <div className="sidebar-spacer"/>
      <div className="promo-card">
        <div className="promo-spark"><Sparkles size={21}/></div>
        <strong>Smarter Agents.<br/>Stronger Network.</strong>
        <span>Everything you need to manage your team.</span>
        <div className="promo-link">Explore more <ArrowRight size={14}/></div>
        <div className="promo-wave"/>
      </div>
      <a className="help-link" href="mailto:hamzamirza.dev9@gmail.com"><CircleHelp size={18}/> Help &amp; Support</a>
      <div className="sidebar-bottom"><span className="online-dot"/> All systems operational</div>
    </aside>
  </>;
}

function Topbar({ onMenu, agents, loading, error, user, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false);
  return <header className="topbar">
    <button className="mobile-menu icon-button" onClick={onMenu}><Menu size={20}/></button>
    <GlobalSearch agents={agents} loading={loading} error={error} />
    <div className="topbar-actions">
      <button className="icon-button notification" aria-label="Notifications"><Bell size={20}/><i/></button>
      <div className="top-divider"/>
      <button className="profile-button" onClick={()=>setProfileOpen(v=>!v)}>
        <span className="profile-avatar">{initials(user.name)}</span><span className="profile-name" title={user.name}>{user.name}</span><ChevronDown size={15}/>
      </button>
      {profileOpen && <div className="profile-menu"><strong>{user.name}</strong><span>{user.email}</span><hr/><button onClick={onLogout}><LogOut size={15}/> Log out</button></div>}
    </div>
  </header>;
}

function GlobalSearch({ agents, loading, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery ? agents.filter(agent =>
    [agent.name, agent.email, agent.phone].some(value => String(value || '').toLowerCase().includes(normalizedQuery))
  ) : [];
  const expanded = open && Boolean(normalizedQuery);
  const results = loading || error ? [] : matches;

  useEffect(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, [location.key]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = event => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const selectAgent = agent => {
    setOpen(false);
    setActiveIndex(-1);
    navigate(`/agents/${encodeURIComponent(getId(agent))}`);
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      inputRef.current?.focus();
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (!results.length) return;
      const fromInput = event.target === inputRef.current;
      const next = fromInput
        ? (event.key === 'ArrowDown' ? 0 : results.length - 1)
        : activeIndex + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0 || next >= results.length) {
        setActiveIndex(-1);
        inputRef.current?.focus();
      } else {
        setActiveIndex(next);
        requestAnimationFrame(() => {
          const option = containerRef.current?.querySelectorAll('[role="option"]')[next];
          option?.focus();
          option?.scrollIntoView({ block: 'nearest' });
        });
      }
    }
  };

  return <div className="global-search-wrap" ref={containerRef} onKeyDown={handleKeyDown}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }}>
    <form className="global-search" role="search" onSubmit={event => {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      const search = query.trim();
      navigate(search ? `/agents?${new URLSearchParams({ search })}` : '/agents');
    }}>
      <Search size={18} aria-hidden="true" />
      <input ref={inputRef} type="text" role="combobox" aria-label="Global agent search"
        aria-autocomplete="list" aria-expanded={expanded} aria-controls="global-agent-results"
        autoComplete="off" placeholder="Search agents by name, email or phone..." value={query}
        onFocus={() => setOpen(true)} onChange={event => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }} />
      {query && <button type="button" className="global-search-clear" aria-label="Clear global search" title="Clear search"
        onClick={() => { setQuery(''); setOpen(false); setActiveIndex(-1); inputRef.current?.focus(); }}><X size={15}/></button>}
    </form>
    {expanded && <div className="global-search-dropdown">
      <div id="global-agent-results" role="listbox" aria-label="Matching agents" className="global-search-results">
        {results.map((agent, index) => <button key={getId(agent)} type="button" role="option"
          aria-selected={index === activeIndex} className={`global-search-result ${index === activeIndex ? 'selected' : ''}`}
          onFocus={() => setActiveIndex(index)} onClick={() => selectAgent(agent)}>
          <Avatar name={agent.name}/>
          <span className="global-search-result-copy"><strong>{agent.name}</strong><span>{agent.email}</span><span>{agent.phone}</span></span>
          <Status status={agent.status}/>
        </button>)}
      </div>
      {!results.length && <div className="global-search-empty" role="status">
        <Search size={21} aria-hidden="true"/>
        <strong>{loading ? 'Loading agents...' : error ? 'Agents are unavailable' : 'No matching agents'}</strong>
        <span>{loading ? 'Your directory will appear shortly.' : error ? 'Try again once your directory is available.' : 'Try another name, email or phone number.'}</span>
      </div>}
    </div>}
  </div>;
}

function PageHeading({ eyebrow='AGENT HUB', title, accent, subtitle, actions, crumb }) {
  return <div className="page-heading">
    <div className="heading-copy">
      <div className="breadcrumb">{eyebrow} <ChevronRight size={13}/> {crumb || title}</div>
      <h1>{title} {accent && <span>{accent}</span>}</h1>
      <p>{subtitle}</p>
    </div>
    {actions && <div className="heading-actions">{actions}</div>}
    <div className="heading-orb orb-one"/><div className="heading-orb orb-two"/>
  </div>;
}

function MetricCard({ icon: Icon, label, value, tone, note, trend }) {
  return <div className={`metric-card ${tone}`}>
    <div className="metric-top"><span className="metric-icon"><Icon size={19}/></span>{note && <span className={`trend ${trend==='down'?'down':''}`}>{trend==='down'?<ArrowDownRight size={13}/>:<ArrowUpRight size={13}/>} {note}</span>}</div>
    <div className="metric-label">{label}</div><div className="metric-value">{value}</div>
    <div className="metric-wave"/>
  </div>;
}

function Dashboard({ agents, loading, error, activities, onRetry, onAdd, onAgents, user }) {
  const active = agents.filter(a=>statusLabel(a.status)==='Active').length;
  const inactive = agents.length-active;
  const recent = [...agents].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,3);
  const feed = activities.length ? activities : recent.map(a=>({id:getId(a), label:'Agent added', detail:`${a.name} was added to the system.`, time:new Date(a.createdAt||Date.now())}));
  return <>
    <PageHeading title="Welcome Back," accent={`${user.name.split(/\s+/)[0]}!`} subtitle="Manage, monitor and grow your agent network with ease and intelligence." actions={<button className="button primary" onClick={onAdd}><Plus size={17}/> Add Agent</button>}/>
    {error && <ErrorBanner message={error} onRetry={onRetry}/>}
    <section className="metrics-grid">
      <MetricCard icon={Users} label="Total Agents" value={loading?'—':agents.length} tone="violet" note="Your network"/>
      <MetricCard icon={Zap} label="Active Agents" value={loading?'—':active} tone="green" note={`${agents.length?Math.round(active/agents.length*100):0}% of total`}/>
      <MetricCard icon={PauseCircle} label="Inactive Agents" value={loading?'—':inactive} tone="rose" note="Needs attention" trend="down"/>
    </section>
    <section className="dashboard-grid">
      <div className="panel status-panel">
        <div className="panel-heading"><div className="panel-title-icon"><Activity size={19}/></div><div><h2>Agent Status</h2><p>Overview of your agents' current status</p></div><span className="live-pill"><i/> From database</span></div>
        <div className="status-content">
          <div className="donut-wrap"><div className="donut" style={{'--active':agents.length?active/agents.length*100:0}}><div><strong>{agents.length}</strong><span>Total Agents</span></div></div></div>
          <div className="status-legend"><div><i className="legend-dot active-dot"/><span>Active</span><strong>{active}</strong><small>{agents.length?Math.round(active/agents.length*100):0}%</small></div><div><i className="legend-dot inactive-dot"/><span>Inactive</span><strong>{inactive}</strong><small>{agents.length?Math.round(inactive/agents.length*100):0}%</small></div></div>
        </div>
        <div className="status-foot"><span><ShieldCheck size={15}/> Status is synced with your agent records</span><button onClick={onAgents}>View agents <ArrowRight size={14}/></button></div>
      </div>
      <div className="panel activity-panel">
        <div className="panel-heading"><div className="panel-title-icon"><Activity size={19}/></div><div><h2>Recent Activity</h2><p>Latest changes in your network</p></div><span className="activity-count">{feed.length} updates</span></div>
        {feed.length ? <div className="activity-list">{feed.slice(0,4).map((item,i)=><div className="activity-item" key={item.id||i}><div className={`activity-icon activity-${i%3}`}>{i===0?<Plus size={15}/>:i===1?<Pencil size={14}/>:<Check size={15}/>}</div><div className="activity-copy"><strong>{item.label}</strong><span>{item.detail}</span></div><time>{item.time?.toLocaleTimeString?.([], {hour:'2-digit',minute:'2-digit'}) || 'Recently'}</time></div>)}</div> : <div className="mini-empty"><span><Activity size={22}/></span><strong>No activity yet</strong><small>Your recent updates will appear here.</small></div>}
      </div>
    </section>
    <section className="panel recent-panel">
      <div className="panel-heading"><div className="panel-title-icon"><Users size={19}/></div><div><h2>Recent Agents</h2><p>Quick access to recently added agents</p></div><button className="text-button" onClick={onAgents}>View all agents <ArrowRight size={15}/></button></div>
      {recent.length ? <div className="recent-cards">{recent.map(a=><button className="recent-card" key={getId(a)} onClick={()=>onAgents()}><Avatar name={a.name}/><span className="recent-info"><strong>{a.name}</strong><small><Status status={a.status}/><span><MapPin size={12}/>{a.serviceArea}</span></small></span><ArrowUpRight size={16}/></button>)}</div> : <EmptyState compact onAdd={onAdd}/>}
    </section>
  </>;
}

function Avatar({name, large=false}) { return <div className={`avatar ${large?'large':''}`}>{initials(name)}</div>; }
function Status({status}) { const active=statusLabel(status)==='Active'; return <span className={`status ${active?'active':'inactive'}`}><i/>{active?'Active':'Inactive'}</span>; }
function ErrorBanner({message,onRetry}) { return <div className="error-banner"><span>{message}</span><button onClick={onRetry}><RefreshCw size={14}/> Retry</button></div>; }

function AgentsPage({ agents, loading, error, onRetry, onAdd, onEdit, onView, onDelete, notify }) {
  const [searchParams,setSearchParams]=useSearchParams();
  const query=searchParams.get('search') || '';
  const setQuery=value=>setSearchParams(previous=>{
    const next=new URLSearchParams(previous);
    if(value)next.set('search',value);else next.delete('search');
    return next;
  },{replace:true});
  const [filter,setFilter]=useState('ALL'); const [page,setPage]=useState(1); const [confirm,setConfirm]=useState(null);
  const pageSize=6;
  const filtered=useMemo(()=>agents.filter(a=>{
    const q=query.toLowerCase();
    const matches=!q || [a.name,a.email,a.phone,a.serviceArea].some(v=>String(v||'').toLowerCase().includes(q));
    return matches && (filter==='ALL'||statusLabel(a.status).toUpperCase()===filter);
  }),[agents,query,filter]);
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize)); const visible=filtered.slice((page-1)*pageSize,page*pageSize);
  useEffect(()=>setPage(1),[query,filter]);
  const remove=async()=>{try{await api.deleteAgent(getId(confirm));onDelete(confirm);}catch(e){notify(friendlyError(e),'error');}finally{setConfirm(null);}};
  return <>
    <PageHeading title="Agents" subtitle="Manage, search and take action on all your agents." actions={<button className="button primary" onClick={onAdd}><Plus size={17}/> Add Agent</button>}/>
    {error && <ErrorBanner message={error} onRetry={onRetry}/>}
    <section className="metrics-grid compact-metrics">
      <MetricCard icon={Users} label="Total Agents" value={loading?'—':agents.length} tone="violet"/>
      <MetricCard icon={Zap} label="Active Agents" value={loading?'—':agents.filter(a=>statusLabel(a.status)==='Active').length} tone="green"/>
      <MetricCard icon={PauseCircle} label="Inactive Agents" value={loading?'—':agents.filter(a=>statusLabel(a.status)!=='Active').length} tone="rose"/>
    </section>
    <section className="panel table-panel">
      <div className="table-title"><div className="panel-title-icon"><Users size={19}/></div><div><h2>All Agents <span className="count-chip">{agents.length}</span></h2><p>Your complete delivery agent directory</p></div></div>
      <div className="table-toolbar">
        <label className="table-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name, email or phone..."/>{query&&<button onClick={()=>setQuery('')}><X size={14}/></button>}</label>
        <label className="filter-select"><Filter size={16}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><ChevronDown size={15}/></label>
        {(query||filter!=='ALL')&&<button className="reset-button" onClick={()=>{setQuery('');setFilter('ALL')}}><RefreshCw size={14}/> Reset</button>}
      </div>
      <div className="table-scroll"><table><thead><tr><th>Agent Name</th><th>Email</th><th>Phone</th><th>Service Area</th><th>Status</th><th className="actions-head">Actions</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan="6"><div className="table-state">Loading agents...</div></td></tr> : visible.length ? visible.map(a=><tr key={getId(a)} onDoubleClick={()=>onView(getId(a))}><td><button className="agent-cell" onClick={()=>onView(getId(a))}><Avatar name={a.name}/><strong>{a.name}</strong></button></td><td>{a.email}</td><td>{a.phone}</td><td><span className="area-cell"><MapPin size={14}/>{a.serviceArea}</span></td><td><Status status={a.status}/></td><td><div className="row-actions"><button className="action-button edit" title="Edit agent" onClick={()=>onEdit(getId(a))}><Pencil size={15}/></button><button className="action-button delete" title="Delete agent" onClick={()=>setConfirm(a)}><Trash2 size={15}/></button></div></td></tr>) : <tr><td colSpan="6"><div className="table-state"><Users size={25}/><strong>{query||filter!=='ALL'?'No matching agents':'No agents yet'}</strong><span>{query||filter!=='ALL'?'Try changing your search or filter.':'Add your first delivery agent to get started.'}</span>{!query&&filter==='ALL'&&<button className="button primary small" onClick={onAdd}><Plus size={15}/> Add Agent</button>}</div></td></tr>}</tbody>
      </table></div>
      <div className="table-footer"><span>Showing {filtered.length?((page-1)*pageSize+1):0}–{Math.min(page*pageSize,filtered.length)} of {filtered.length} agents</span><div className="pagination"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><span>{page} / {pages}</span><button disabled={page===pages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div></div>
    </section>
    {confirm && <Modal title="Delete agent?" onClose={()=>setConfirm(null)}><p className="modal-copy">Are you sure you want to delete <strong>{confirm.name}</strong>? This action cannot be undone.</p><div className="modal-actions"><button className="button secondary" onClick={()=>setConfirm(null)}>Cancel</button><button className="button danger" onClick={remove}><Trash2 size={15}/> Delete Agent</button></div></Modal>}
  </>;
}

function AgentForm({ onSubmit, notify }) {
  const [form,setForm]=useState({name:'',email:'',phone:'',serviceArea:'',status:'ACTIVE'});
  const [busy,setBusy]=useState(false); const [errors,setErrors]=useState({});
  const change=e=>{const {name,value}=e.target;setForm(f=>({...f,[name]:value}));setErrors(v=>({...v,[name]:''}));};
  const validate=()=>{const e={};if(!form.name.trim())e.name='Full name is required';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email='Enter a valid email address';if(!form.phone.trim())e.phone='Phone number is required';if(!form.serviceArea.trim())e.serviceArea='Service area is required';setErrors(e);return !Object.keys(e).length;};
  const submit=async e=>{e.preventDefault();if(!validate())return;setBusy(true);try{await api.createAgent({...form,name:form.name.trim(),email:form.email.trim(),phone:form.phone.trim(),serviceArea:form.serviceArea.trim()});onSubmit(form);}catch(err){notify(friendlyError(err),'error');}finally{setBusy(false);}};
  return <><PageHeading title="Add Agent" subtitle="Create a new agent and add them to your network." crumb="Add Agent"/>
    <div className="form-layout"><aside className="form-intro panel"><div className="intro-illustration"><div className="intro-back"/><div className="intro-user"><UserRound size={54}/></div><span className="intro-plus"><Plus size={23}/></span><Sparkles className="intro-spark" size={22}/></div><h2>Add a New Agent</h2><p>Fill in the details to create an agent and manage their access in the system.</p><div className="intro-note"><ShieldCheck size={16}/> Your agent information stays in your workspace.</div></aside>
      <section className="panel form-panel"><div className="form-panel-heading"><div className="panel-title-icon"><UserRound size={19}/></div><div><h2>Agent Information</h2><p>Enter the details below to create a new agent.</p></div></div>
        <form onSubmit={submit} noValidate><div className="form-grid">
          <Field label="Full Name" name="name" value={form.name} onChange={change} error={errors.name} placeholder="Enter full name" icon={UserRound} wide/>
          <Field label="Email" name="email" value={form.email} onChange={change} error={errors.email} placeholder="Enter email address" icon={Mail}/>
          <Field label="Phone" name="phone" value={form.phone} onChange={change} error={errors.phone} placeholder="Enter phone number" icon={Phone}/>
          <Field label="Service Area" name="serviceArea" value={form.serviceArea} onChange={change} error={errors.serviceArea} placeholder="e.g. Lucknow, UP" icon={MapPin} wide/>
          <div className="field wide"><label>Status <b>*</b></label><div className="status-options"><label className={`status-option ${form.status==='ACTIVE'?'selected':''}`}><input type="radio" name="status" value="ACTIVE" checked={form.status==='ACTIVE'} onChange={change}/><span className="radio-ui"/><i className="status-dot green-dot"/> Active</label><label className={`status-option ${form.status==='INACTIVE'?'selected':''}`}><input type="radio" name="status" value="INACTIVE" checked={form.status==='INACTIVE'} onChange={change}/><span className="radio-ui"/><i className="status-dot red-dot"/> Inactive</label></div></div>
        </div><div className="form-actions"><button type="button" className="button secondary" onClick={()=>history.back()}>Cancel</button><button className="button primary" disabled={busy}>{busy?<span className="spinner"/>:<Plus size={17}/>} {busy?'Creating...':'Add Agent'}</button></div></form>
      </section></div>
  </>;
}

function Field({label,name,value,onChange,error,placeholder,icon:Icon,wide}) {return <div className={`field ${wide?'wide':''}`}><label htmlFor={name}>{label} <b>*</b></label><div className={`input-wrap ${error?'has-error':''}`}>{Icon&&<Icon size={17}/>}<input id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} autoComplete="off"/></div>{error&&<small className="field-error">{error}</small>}</div>;}

function EditAgent({agents,refresh,onSubmit,notify}) {
  const {id}=useParams();const [agent,setAgent]=useState(null);const [loading,setLoading]=useState(true);
  useEffect(()=>{let alive=true;(async()=>{try{const found=agents.find(a=>String(getId(a))===id)||await api.getAgent(id);if(alive)setAgent(found);}catch(e){notify(friendlyError(e),'error');}finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[id,agents,notify]);
  if(loading)return <div className="loading-page">Loading agent details...</div>;
  if(!agent)return <NotFound/>;
  return <EditForm agent={agent} onSubmit={onSubmit} notify={notify}/>;
}

function EditForm({agent,onSubmit,notify}) {
  const [form,setForm]=useState({name:agent.name||'',email:agent.email||'',phone:agent.phone||'',serviceArea:agent.serviceArea||'',status:String(agent.status||'ACTIVE').toUpperCase()});
  const [busy,setBusy]=useState(false);
  const change=e=>setForm(f=>({...f,[e.target.name]:e.target.value}));
  const submit=async e=>{e.preventDefault();setBusy(true);try{await api.updateAgent(getId(agent),form);onSubmit({...agent,...form});}catch(err){notify(friendlyError(err),'error');}finally{setBusy(false);}};
  return <><PageHeading title="Edit Agent" subtitle="Update the information and status for this agent." crumb="Agents / Edit Agent" actions={<button className="button secondary" onClick={()=>history.back()}><ArrowLeft size={16}/> Back</button>}/><section className="panel edit-panel"><div className="form-panel-heading"><Avatar name={agent.name}/><div><h2>Edit Agent Information</h2><p>Changes will be saved to your agent record.</p></div></div><form onSubmit={submit}><div className="form-grid"><Field label="Full Name" name="name" value={form.name} onChange={change} placeholder="Full name" icon={UserRound} wide/><Field label="Email" name="email" value={form.email} onChange={change} placeholder="Email address" icon={Mail}/><Field label="Phone" name="phone" value={form.phone} onChange={change} placeholder="Phone number" icon={Phone}/><Field label="Service Area" name="serviceArea" value={form.serviceArea} onChange={change} placeholder="Service area" icon={MapPin} wide/><div className="field wide"><label>Status</label><div className="status-options"><label className={`status-option ${form.status==='ACTIVE'?'selected':''}`}><input type="radio" name="status" value="ACTIVE" checked={form.status==='ACTIVE'} onChange={change}/><span className="radio-ui"/><i className="status-dot green-dot"/> Active</label><label className={`status-option ${form.status==='INACTIVE'?'selected':''}`}><input type="radio" name="status" value="INACTIVE" checked={form.status==='INACTIVE'} onChange={change}/><span className="radio-ui"/><i className="status-dot red-dot"/> Inactive</label></div></div></div><div className="form-actions"><button type="button" className="button secondary" onClick={()=>history.back()}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Saving...':'Save Changes'}</button></div></form></section></>;
}

function AgentDetails({agents,loading,onEdit,onDelete,notify}) {
  const {id}=useParams();const [agent,setAgent]=useState(null);const [detailLoading,setDetailLoading]=useState(true);const [busy,setBusy]=useState(false);const [confirm,setConfirm]=useState(false);
  useEffect(()=>{let alive=true;setDetailLoading(true);(async()=>{const found=agents.find(a=>String(getId(a))===id);if(found){if(alive){setAgent(found);setDetailLoading(false);}return;}try{const a=await api.getAgent(id);if(alive)setAgent(a);}catch(e){if(alive)notify(friendlyError(e),'error');}finally{if(alive)setDetailLoading(false);}})();return()=>{alive=false};},[id,agents,notify]);
  if(!agent&&detailLoading)return <div className="loading-page">Loading agent details...</div>;
  if(!agent)return <NotFound/>;
  const remove=async()=>{setBusy(true);try{await api.deleteAgent(id);onDelete(agent);}catch(e){notify(friendlyError(e),'error');}finally{setBusy(false);setConfirm(false);}};
  return <><PageHeading title="Agent" accent="Details" subtitle="View complete information about this agent." crumb="Agents / Agent Details" actions={<><button className="button outline" onClick={()=>onEdit(id)}><Edit3 size={16}/> Edit Agent</button><button className="button danger-soft" onClick={()=>setConfirm(true)}><Trash2 size={16}/> Delete Agent</button></>}/>
    <div className="details-layout"><section className="panel profile-card"><div className="profile-orbit"/><Avatar name={agent.name} large/><h2>{agent.name}</h2><p>{agent.email}</p><p>{agent.phone}</p><Status status={agent.status}/><div className="profile-caption">DELIVERY AGENT</div></section>
      <div className="details-right"><section className="panel info-panel"><div className="form-panel-heading"><div className="panel-title-icon"><Users size={19}/></div><div><h2>Agent Information</h2><p>Personal and service information</p></div></div><InfoRow icon={UserRound} label="Full Name" value={agent.name}/><InfoRow icon={Mail} label="Email" value={agent.email}/><InfoRow icon={Phone} label="Phone" value={agent.phone}/><InfoRow icon={MapPin} label="Service Area" value={agent.serviceArea}/><InfoRow icon={ShieldCheck} label="Status" value={<Status status={agent.status}/>}/></section>
      <div className="date-grid"><DateCard icon={CalendarDays} label="Created On" value={dateLabel(agent.createdAt)}/><DateCard icon={Clock3} label="Updated On" value={dateLabel(agent.updatedAt)}/></div></div></div>
    {confirm&&<Modal title="Delete agent?" onClose={()=>setConfirm(false)}><p className="modal-copy">Are you sure you want to delete <strong>{agent.name}</strong>? This action cannot be undone.</p><div className="modal-actions"><button className="button secondary" onClick={()=>setConfirm(false)}>Cancel</button><button className="button danger" disabled={busy} onClick={remove}><Trash2 size={15}/> Delete Agent</button></div></Modal>}
  </>;
}
function InfoRow({icon:Icon,label,value}){return <div className="info-row"><span className="info-icon"><Icon size={17}/></span><span className="info-label">{label}</span><strong>{value||'—'}</strong></div>}
function DateCard({icon:Icon,label,value}){return <div className="panel date-card"><span className="date-icon"><Icon size={21}/></span><div><small>{label}</small><strong>{value}</strong></div></div>}
function EmptyState({onAdd,compact=false}){return <div className={`empty-state ${compact?'compact':''}`}><div className="empty-art"><Truck size={compact?27:42}/><span><Plus size={16}/></span></div><h2>No agents yet</h2><p>Add your first delivery agent to get started.</p><button className="button primary" onClick={onAdd}><Plus size={16}/> Add Agent</button></div>}
function Modal({title,children,onClose}){return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-heading"><h3>{title}</h3><button className="icon-button" onClick={onClose}><X size={18}/></button></div>{children}</div></div>}
function NotFound(){const nav=useNavigate();return <div className="not-found panel"><div className="empty-art"><Search size={30}/></div><h2>We couldn't find that page</h2><p>The page or agent may have been moved or deleted.</p><button className="button primary" onClick={()=>nav('/agents')}>Back to agents</button></div>}

export default App;
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyRound, LogIn, Mail, UserRound } from 'lucide-react';
import { api } from './api.js';

export default function AuthPage({ mode, onAuthenticated, sessionError }) {
  const register = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const fields = [
    ...(register ? [{ name: 'name', label: 'Name', type: 'text', icon: UserRound, autoComplete: 'name' }] : []),
    { name: 'email', label: 'Email', type: 'email', icon: Mail, autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', icon: KeyRound, autoComplete: register ? 'new-password' : 'current-password' },
  ];
  const submit = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const data = register ? form : { email: form.email, password: form.password };
      onAuthenticated(await (register ? api.register(data) : api.login(data)));
    } catch (failure) {
      setError(failure.errors?.[0]?.message || failure.message || 'Please try again.');
    } finally { setBusy(false); }
  };
  return <main className="auth-shell">
    <div className="brand"><div className="brand-mark">A</div><span>Agent Hub<small>Aone Tech</small></span></div>
    <section className="panel form-panel auth-panel">
      <div className="form-panel-heading"><div className="panel-title-icon"><UserRound size={19}/></div><div><h2>{register ? 'Create your account' : 'Welcome back'}</h2><p>{register ? 'Join your Agent Hub workspace.' : 'Sign in to your Agent Hub account.'}</p></div></div>
      {(error || sessionError) && <div className="error-banner" role="alert"><span>{error || sessionError}</span></div>}
      <form onSubmit={submit}>
        <div className="form-grid">{fields.map(({ name, label, type, icon: Icon, autoComplete }) => <div className="field wide" key={name}>
          <label htmlFor={`auth-${name}`}>{label} <b>*</b></label>
          <div className="input-wrap"><Icon size={17}/><input id={`auth-${name}`} name={name} type={type} autoComplete={autoComplete} required
            minLength={name === 'name' ? 2 : name === 'password' && register ? 8 : undefined}
            maxLength={name === 'name' ? 100 : name === 'password' ? 72 : 254}
            value={form[name]} onChange={event => setForm(previous => ({ ...previous, [name]: event.target.value }))}/></div>
        </div>)}</div>
        <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? <span className="spinner"/> : <LogIn size={17}/>} {busy ? 'Please wait...' : register ? 'Create account' : 'Log in'}</button></div>
      </form>
      <p className="auth-switch">{register ? 'Already have an account?' : 'New to Agent Hub?'} <Link to={register ? '/login' : '/register'} state={location.state}>{register ? 'Log in' : 'Create account'}</Link></p>
    </section>
  </main>;
}
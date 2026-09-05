import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { User, Mail, ArrowRight, Lock, Calendar, AtSign, Loader2, AlertCircle } from 'lucide-react';
import VibesterLogo from '../assets/VIBESTER.svg';
import { registerApi } from '../api/auth';

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    bornAt: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerApi({
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
        bornAt: form.bornAt,
      });
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-bg-dark text-white overflow-hidden">
      <div className="hidden lg:flex flex-col flex-1 relative bg-gradient-to-tr from-bg-dark to-[#1a0f0a] p-12 overflow-hidden justify-between border-r border-border-subtle">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-brand-fire/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="relative z-10 flex-1 flex items-start justify-center w-full pt-4">
          <img src={VibesterLogo} alt="Vibester" className="w-3/4 max-w-[400px]" />
        </div>

        <div className="relative z-10 max-w-lg mb-20">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-6xl font-extrabold tracking-tight mb-6 leading-tight"
          >
            A noite te espera. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-fire to-orange-400">
              Assuma o controle.
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg text-gray-400 font-medium"
          >
            Traga seu negócio para o radar mais quente da cidade. Junte-se a dezenas de estabelecimentos que já revolucionaram sua captação de clientes.
          </motion.p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative z-10 overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md my-auto py-10"
        >
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-2">Seja um Parceiro</h2>
            <p className="text-gray-400">Crie sua conta de acesso ao painel.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <User className="w-5 h-5" />
                </div>
                <input 
                  type="text" required value={form.name} onChange={set('name')}
                  className="w-full bg-bg-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                  placeholder="João Silva"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <AtSign className="w-5 h-5" />
                </div>
                <input 
                  type="text" required value={form.username} onChange={set('username')}
                  className="w-full bg-bg-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                  placeholder="joaosilva"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">E-mail Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" required value={form.email} onChange={set('email')}
                  className="w-full bg-bg-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                  placeholder="contato@neonpub.com.br"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type="password" required minLength={6} value={form.password} onChange={set('password')}
                  className="w-full bg-bg-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Data de Nascimento</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Calendar className="w-5 h-5" />
                </div>
                <input 
                  type="date" required value={form.bornAt} onChange={set('bornAt')}
                  className="w-full bg-bg-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300 [color-scheme:dark]"
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-white hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed text-bg-dark py-3.5 rounded-xl font-bold text-lg transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
              ) : (
                <><span>Continuar</span><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-400">
            Já possui cadastro?{' '}
            <NavLink to="/login" className="text-white font-medium hover:text-brand-fire transition-colors underline decoration-border-subtle underline-offset-4">
              Fazer login
            </NavLink>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

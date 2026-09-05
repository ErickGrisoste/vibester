import { useState } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, Loader2, CheckCircle2 } from 'lucide-react';
import VibesterLogo from '../assets/VIBESTER.svg';
import { loginApi } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';

import ErrorState from '../components/ErrorState';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const justVerified = (location.state as { verified?: boolean })?.verified;

  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginApi({ email, password });
      await login({ authId: res.authId, token: res.token, accountId: res.accountId });
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message ?? 'Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-bg-dark text-white overflow-hidden">
      <div className="hidden lg:flex flex-col flex-1 relative bg-gradient-to-br from-bg-dark to-bg-card p-12 overflow-hidden justify-between border-r border-border-subtle">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-fire/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-fire/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="relative z-10 flex-1 flex items-start justify-center w-full pt-4">
          <img src={VibesterLogo} alt="Vibester" className="w-3/4 max-w-[400px]" />
        </div>

        <div className="relative z-10 max-w-lg mb-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-6xl font-extrabold tracking-tight mb-6 leading-tight"
          >
            Sua casa. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-fire to-orange-400">
              O radar da noite.
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg text-gray-400 font-medium"
          >
            Gerencie seu estabelecimento, crie listas VIP, dispare eventos relâmpago e veja o fluxo da noite em tempo real.
          </motion.p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-2">Acesse o Painel</h2>
            <p className="text-gray-400">Insira suas credenciais para gerenciar sua Vibe.</p>
          </div>

          {justVerified && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-6"
            >
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-400">E-mail verificado! Faça login para continuar.</p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">E-mail Corporativo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  className="w-full bg-bg-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                  placeholder="admin@seubar.com.br"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-gray-300">Senha</label>
                <a href="#" className="text-sm font-medium text-brand-fire hover:text-orange-400 transition-colors">Esqueceu?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  className="w-full bg-bg-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <ErrorState error={error} compact />
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-brand-fire hover:bg-[#ff571a] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,69,0,0.3)] hover:shadow-[0_0_30px_rgba(255,69,0,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Entrando...</> : 'Entrar no Radar'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-400">
            Não tem uma conta parceira?{' '}
            <NavLink to="/register" className="text-white font-medium hover:text-brand-fire transition-colors underline decoration-border-subtle underline-offset-4">
              Solicite o acesso
            </NavLink>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

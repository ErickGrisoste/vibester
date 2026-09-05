import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import VibesterLogo from '../assets/VIBESTER.svg';
import { verifyEmailApi } from '../api/auth';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string })?.email ?? '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[idx] = val.slice(-1);
    setCode(next);
    setError(null);
    if (val && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) {
      setError('Insira o código completo de 6 dígitos.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyEmailApi({ email, code: fullCode });
      setSuccess(true);
      setTimeout(() => navigate('/login', { state: { verified: true } }), 1800);
    } catch (err) {
      setError((err as Error).message ?? 'Código inválido. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-bg-dark text-white items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-brand-fire/10 rounded-full blur-[150px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md z-10"
      >
        <div className="flex justify-center mb-8">
          <img src={VibesterLogo} alt="Vibester" className="h-8" />
        </div>

        <div className="glass-panel rounded-2xl p-8 border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-brand-fire/10 border border-brand-fire/20 flex items-center justify-center">
              <Mail className="w-6 h-6 text-brand-fire" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Verifique seu e-mail</h2>
              <p className="text-sm text-gray-400">
                Código enviado para{' '}
                <span className="text-white font-medium">{email || 'seu e-mail'}</span>
              </p>
            </div>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <p className="text-green-400 font-bold text-lg">Conta criada com sucesso!</p>
              <p className="text-gray-400 text-sm mt-1">Redirecionando para o login...</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <p className="text-sm text-gray-400 mb-4 text-center">
                  Insira o código de 6 dígitos
                </p>
                <div className="flex gap-3 justify-center" onPaste={handlePaste}>
                  {code.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-12 h-14 text-center text-xl font-bold bg-bg-card border border-border-subtle rounded-xl text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                    />
                  ))}
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-sm text-center"
                >
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-fire hover:bg-[#ff571a] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(255,69,0,0.3)] hover:shadow-[0_0_30px_rgba(255,69,0,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Verificando...</>
                ) : 'Confirmar Código'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/register')}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar ao cadastro
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

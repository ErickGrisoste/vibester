import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Store, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import VibesterLogo from '../assets/VIBESTER.svg';
import { listEstablishments, type Establishment } from '../api/establishment';
import { useAuth } from '../contexts/AuthContext';

import ErrorState from '../components/ErrorState';

export default function SelectEstablishment() {
  const navigate = useNavigate();
  const { setEstablishment } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  const fetchEstablishments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listEstablishments({ search: search || undefined, limit: 30 });
      setEstablishments(res.data);
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao carregar estabelecimentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchEstablishments();
    }, 350);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleSelect = async (establishment: Establishment) => {
    setSelecting(establishment.id);
    setEstablishment(establishment);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen w-full bg-bg-dark text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-brand-fire/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-fire/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <img src={VibesterLogo} alt="Vibester" className="h-8 mb-8" />
          <h1 className="text-3xl font-bold text-center mb-2">Qual é o seu estabelecimento?</h1>
          <p className="text-gray-400 text-center text-sm">
            Selecione para gerenciar. Você pode trocar depois nas configurações.
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar pelo nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-card border border-border-subtle rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
          />
        </div>

        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-brand-fire animate-spin" />
            </div>
          )}

          {!loading && error && (
            <ErrorState error={error} onRetry={fetchEstablishments} />
          )}

          {!loading && !error && establishments.length === 0 && (
            <div className="glass-panel rounded-xl p-10 text-center border-white/5">
              <Store className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum estabelecimento encontrado.</p>
            </div>
          )}

          {!loading && !error && establishments.map((est, i) => (
            <motion.button
              key={est.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleSelect(est)}
              disabled={!!selecting}
              className="w-full flex items-center gap-4 glass-panel rounded-xl p-4 border-white/5 hover:border-brand-fire/40 hover:bg-white/[0.04] transition-all duration-300 text-left group disabled:opacity-60"
            >
              {est.photoUrl ? (
                <img
                  src={est.photoUrl}
                  alt={est.name}
                  className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-brand-fire/10 border border-brand-fire/20 flex items-center justify-center flex-shrink-0">
                  <Store className="w-6 h-6 text-brand-fire" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-bold text-white group-hover:text-brand-fire transition-colors truncate">
                  {est.name}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{est.endereco ?? est.category}</span>
                </div>
              </div>

              {selecting === est.id ? (
                <Loader2 className="w-5 h-5 text-brand-fire animate-spin flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-fire group-hover:translate-x-1 transition-all flex-shrink-0" />
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

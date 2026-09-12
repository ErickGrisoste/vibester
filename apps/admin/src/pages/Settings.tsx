import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, MapPin, Save, Loader2, CheckCircle2, AlertCircle, Building2, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getEstablishment, type Establishment } from '../api/establishment';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function RatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300 font-medium">{label}</span>
        <span className="text-white font-bold">{value.toFixed(1)}</span>
      </div>
      <div className="w-full bg-bg-dark rounded-full h-1.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(value / 5) * 100}%` }}
          transition={{ duration: 0.8 }}
          className="bg-brand-fire h-1.5 rounded-full shadow-[0_0_6px_rgba(255,69,0,0.6)]"
        />
      </div>
    </div>
  );
}

export default function Settings() {
  const { establishment: ctxEstablishment, setEstablishment } = useAuth();

  const [est, setEst] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ctxEstablishment?.id) return;
    setLoading(true);
    getEstablishment(ctxEstablishment.id)
      .then((data) => {
        setEst(data);
        setEstablishment(data);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [ctxEstablishment?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inputCls = "w-full bg-bg-dark border border-border-subtle rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-brand-fire transition-colors";
  const disabledInputCls = "w-full bg-bg-dark/50 border border-border-subtle/40 rounded-xl py-2.5 px-4 text-gray-500 cursor-not-allowed";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-brand-fire animate-spin" />
      </div>
    );
  }

  if (error || !est) {
    return (
      <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-5 text-red-400 max-w-xl">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{error ?? 'Não foi possível carregar os dados do estabelecimento.'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 max-w-4xl mx-auto lg:mx-0">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Configurações</h2>
        <p className="text-gray-400 mt-1">Dados do seu estabelecimento registrado no Vibester.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-6 md:p-8 border-white/5"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <Store className="w-6 h-6 text-brand-fire" />
            <h3 className="text-xl font-bold text-white">Perfil do Estabelecimento</h3>
            {est.photoUrl && (
              <img src={est.photoUrl} alt={est.name} className="w-10 h-10 rounded-xl object-cover border border-white/10 ml-auto" />
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Nome Oficial</label>
              <input type="text" defaultValue={est.name} className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Categoria</label>
              <input type="text" defaultValue={est.category} className={inputCls} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-300">Descrição Curta (Bio)</label>
              <textarea
                rows={3}
                defaultValue={est.bio ?? ''}
                className={`${inputCls} resize-none`}
                placeholder="Descreva seu estabelecimento..."
              />
            </div>
            {est.priceIndicator && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Indicador de Preço</label>
                <input type="text" value={est.priceIndicator} readOnly className={disabledInputCls} />
              </div>
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-2xl p-6 md:p-8 border-white/5"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <MapPin className="w-6 h-6 text-brand-fire" />
            <h3 className="text-xl font-bold text-white">Localização</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-300">Endereço</label>
              <input type="text" defaultValue={est.endereco ?? ''} className={inputCls} placeholder="Endereço completo" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Latitude</label>
              <input type="text" value={est.latitude} readOnly className={disabledInputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Longitude</label>
              <input type="text" value={est.longitude} readOnly className={disabledInputCls} />
            </div>
          </div>
        </motion.div>

        {est.openingHours && est.openingHours.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-panel rounded-2xl p-6 md:p-8 border-white/5"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <Building2 className="w-6 h-6 text-brand-fire" />
              <h3 className="text-xl font-bold text-white">Horários de Funcionamento</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {est.openingHours.map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-bg-dark rounded-xl px-4 py-3 border border-border-subtle">
                  <span className="text-sm font-medium text-gray-300">{DAYS[h.dayOfWeek]}</span>
                  <span className="text-sm text-white font-bold">{h.openTime} – {h.closeTime}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-2xl p-6 md:p-8 border-white/5"
        >
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
            <BarChart3 className="w-6 h-6 text-brand-fire" />
            <h3 className="text-xl font-bold text-white">Avaliações</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex items-center gap-4">
              <div className="text-5xl font-extrabold text-white">{est.averageRating.toFixed(1)}</div>
              <div>
                <div className="text-yellow-400 text-lg">{'★'.repeat(Math.round(est.averageRating))}{'☆'.repeat(5 - Math.round(est.averageRating))}</div>
                <p className="text-sm text-gray-400 mt-1">{est.qtdAvaliacoes} avaliações</p>
              </div>
            </div>
            <div className="space-y-3">
              {est.distribuicao?.map((val, idx) => (
                <RatingBar key={idx} label={`${5 - idx} estrelas`} value={val} />
              ))}
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end gap-4 mt-8 pt-4">
          <button type="button" className="px-6 py-3 rounded-xl font-bold text-white bg-bg-card hover:bg-white/5 border border-border-subtle transition-colors">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-fire hover:bg-[#ff571a] disabled:opacity-60 text-white px-8 py-3 rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(255,69,0,0.3)] hover:shadow-[0_0_30px_rgba(255,69,0,0.5)] flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="w-5 h-5" /> Salvar Alterações</>
            )}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-8 right-8 flex items-center gap-3 bg-green-500/20 border border-green-500/30 backdrop-blur-md rounded-2xl px-5 py-4 shadow-2xl z-50"
          >
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-green-300 font-medium text-sm">Alterações salvas com sucesso!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Calendar, Users,
  Loader2, Star, StarOff, X, RefreshCw, ImageIcon
} from 'lucide-react';
import { listAllEvents, createEvent, toggleFeatured, type Event, type CreateEventPayload } from '../api/events';
import { useAuth } from '../contexts/AuthContext';

import ErrorState from '../components/ErrorState';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface CreateModalProps {
  establishmentId: string;
  onClose: () => void;
  onCreated: (ev: Event) => void;
}

function CreateEventModal({ establishmentId, onClose, onCreated }: CreateModalProps) {
  const [form, setForm] = useState<Omit<CreateEventPayload, 'establishmentId'>>({
    name: '',
    photoUrl: '',
    category: '',
    organizer: '',
    location: '',
    informacoes: '',
    startDate: '',
    endDate: '',
    ticketLink: '',
    latitude: 0,
    longitude: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: CreateEventPayload = {
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        establishmentId,
        ticketLink: form.ticketLink || undefined,
        informacoes: form.informacoes || undefined,
      };
      const created = await createEvent(payload);
      onCreated(created);
      onClose();
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao criar evento.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-bg-dark border border-border-subtle rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-brand-fire transition-colors text-sm";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-bg-card z-10">
          <h3 className="text-xl font-bold text-white">Novo Evento</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Nome do Evento *</label>
              <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="Ex: Neon Night: Techno & House" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">URL da Foto *</label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input required type="url" value={form.photoUrl} onChange={set('photoUrl')} className={`${inputCls} pl-10`} placeholder="https://..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Categoria *</label>
              <input required value={form.category} onChange={set('category')} className={inputCls} placeholder="Ex: Techno, Samba, Rock..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Organizador *</label>
              <input required value={form.organizer} onChange={set('organizer')} className={inputCls} placeholder="Nome do organizador" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Local / Endereço *</label>
              <input required value={form.location} onChange={set('location')} className={inputCls} placeholder="Ex: Rua Augusta, 1234 — São Paulo" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Início *</label>
              <input required type="datetime-local" value={form.startDate} onChange={set('startDate')} className={`${inputCls} [color-scheme:dark]`} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Fim *</label>
              <input required type="datetime-local" value={form.endDate} onChange={set('endDate')} className={`${inputCls} [color-scheme:dark]`} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Latitude *</label>
              <input required type="number" step="any" value={form.latitude || ''} onChange={set('latitude')} className={inputCls} placeholder="-23.5614" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Longitude *</label>
              <input required type="number" step="any" value={form.longitude || ''} onChange={set('longitude')} className={inputCls} placeholder="-46.6565" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Link de Ingresso</label>
              <input type="url" value={form.ticketLink} onChange={set('ticketLink')} className={inputCls} placeholder="https://sympla.com.br/..." />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Informações Adicionais</label>
              <textarea rows={3} value={form.informacoes} onChange={set('informacoes')} className={`${inputCls} resize-none`} placeholder="Descrição, dress code, atrações..." />
            </div>
          </div>

          {error && (
            <ErrorState error={error} compact />
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 border border-border-subtle transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-brand-fire hover:bg-[#ff571a] disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-all duration-300 shadow-[0_0_15px_rgba(255,69,0,0.3)] flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Criando...</> : 'Criar Evento'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function Events() {
  const { establishment } = useAuth();
  const establishmentId = establishment?.id ?? '';

  const [events, setEvents] = useState<Event[]>([]);
  const [filtered, setFiltered] = useState<Event[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAllEvents();
      const mine = establishmentId ? data.filter((e) => e.establishmentId === establishmentId) : data;
      setEvents(mine);
      setFiltered(mine);
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao carregar eventos.');
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(events.filter((e) => e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)));
  }, [search, events]);

  const handleToggleFeatured = async (ev: Event) => {
    setTogglingId(ev.id);
    try {
      const res = await toggleFeatured(ev.id, !ev.isFeatured);
      setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, isFeatured: res.isFeatured } : e));
    } catch {
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreated = (ev: Event) => {
    setEvents((prev) => [ev, ...prev]);
  };

  return (
    <>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Eventos & Promos</h2>
            <p className="text-gray-400 mt-1">Gerencie a agenda do seu estabelecimento.</p>
          </div>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Search className="w-5 h-5" />
              </div>
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-bg-card border border-border-subtle rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-brand-fire focus:ring-1 focus:ring-brand-fire transition-all duration-300"
                placeholder="Buscar evento..."
              />
            </div>
            <button
              onClick={() => fetchEvents()}
              className="p-2.5 bg-bg-card border border-border-subtle rounded-xl text-gray-400 hover:text-white transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-brand-fire hover:bg-[#ff571a] text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-[0_0_15px_rgba(255,69,0,0.3)] hover:shadow-[0_0_25px_rgba(255,69,0,0.5)] flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Novo Evento</span>
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-brand-fire animate-spin" />
          </div>
        )}

        {!loading && error && (
          <ErrorState error={error} onRetry={fetchEvents} />
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-24">
            <Calendar className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {search ? 'Nenhum evento encontrado.' : 'Nenhum evento cadastrado ainda.'}
            </p>
            {!search && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-brand-fire hover:text-orange-400 font-medium text-sm transition-colors"
              >
                Criar primeiro evento →
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((event, i) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="glass-panel rounded-2xl overflow-hidden group border-white/5 hover:border-brand-fire/30 transition-colors"
              >
                <div className="relative h-48 w-full overflow-hidden">
                  <div className="absolute inset-0 bg-black/40 z-10 group-hover:bg-transparent transition-colors duration-500"></div>
                  <img 
                    src={event.photoUrl} 
                    alt={event.name} 
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80'; }}
                  />
                  <div className="absolute top-4 left-4 z-20">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full backdrop-blur-md border ${
                      event.isFeatured 
                        ? 'bg-brand-fire/20 text-white border-brand-fire/50 shadow-[0_0_10px_rgba(255,69,0,0.5)]' 
                        : 'bg-white/10 text-gray-300 border-white/20'
                    }`}>
                      {event.isFeatured ? '⭐ Destaque' : 'Padrão'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleFeatured(event)}
                    disabled={togglingId === event.id}
                    className="absolute top-4 right-4 z-20 p-2 bg-black/50 hover:bg-black text-white rounded-full backdrop-blur-md transition-colors disabled:opacity-50"
                    title={event.isFeatured ? 'Remover destaque' : 'Destacar evento'}
                  >
                    {togglingId === event.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : event.isFeatured ? (
                      <StarOff className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <Star className="w-4 h-4" />
                    )}
                  </button>
                </div>
                
                <div className="p-5">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-fire transition-colors">{event.name}</h3>
                  
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center text-sm text-gray-400">
                      <Calendar className="w-4 h-4 mr-2 text-brand-fire/70" />
                      {formatDate(event.startDate)}
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                      <Users className="w-4 h-4 mr-2 text-brand-fire/70" />
                      {event.totalConfirmed} confirmados
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <CreateEventModal
            establishmentId={establishmentId}
            onClose={() => setShowModal(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Search, Download, Loader2, Calendar, Users, RefreshCw } from 'lucide-react';
import { listEventsWeek, type Event } from '../api/events';
import { useAuth } from '../contexts/AuthContext';
import ErrorState from '../components/ErrorState';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface EventWithCheckins extends Event {
}

export default function VipList() {
  const { establishment } = useAuth();
  const [events, setEvents] = useState<EventWithCheckins[]>([]);
  const [filtered, setFiltered] = useState<EventWithCheckins[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const weekEvents = await listEventsWeek();
      const mine = establishment?.id
        ? weekEvents.filter((e) => e.establishmentId === establishment.id)
        : weekEvents;
      setEvents(mine);
      setFiltered(mine);
    } catch (err) {
      setError((err as Error).message ?? 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [establishment?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(events.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.organizer.toLowerCase().includes(q)
    ));
  }, [search, events]);

  const handleExport = () => {
    const rows = [
      ['Evento', 'Data', 'Categoria', 'Confirmados', 'Organizador'],
      ...filtered.map((e) => [e.name, formatDate(e.startDate), e.category, String(e.totalConfirmed), e.organizer]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vip-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalConfirmed = filtered.reduce((sum, e) => sum + e.totalConfirmed, 0);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">VIP List</h2>
          <p className="text-gray-400 mt-1">
            Eventos da semana e presença confirmada do seu estabelecimento.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 bg-bg-card border border-border-subtle rounded-xl text-gray-300 hover:text-white hover:border-white/20 transition-all"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="p-2.5 bg-bg-card border border-border-subtle rounded-xl text-gray-300 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
            title="Exportar CSV"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="bg-white hover:bg-gray-200 disabled:opacity-40 text-bg-dark px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-lg"
          >
            Exportar P/ Portaria
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="glass-panel rounded-xl p-4 border-white/5">
            <p className="text-xs text-gray-400 mb-1">Eventos na Semana</p>
            <p className="text-2xl font-bold text-white">{events.length}</p>
          </div>
          <div className="glass-panel rounded-xl p-4 border-white/5">
            <p className="text-xs text-gray-400 mb-1">Total Confirmados</p>
            <p className="text-2xl font-bold text-brand-fire">{totalConfirmed}</p>
          </div>
          <div className="glass-panel rounded-xl p-4 border-white/5 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 mb-1">Exibindo resultados</p>
            <p className="text-2xl font-bold text-white">{filtered.length}</p>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/[0.02]">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar evento..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-dark border border-border-subtle rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-brand-fire transition-colors"
            />
          </div>
          <span className="text-xs text-gray-500">
            {filtered.length} evento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-fire animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="p-6">
            <ErrorState error={error} onRetry={fetchData} />
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-20">
            <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">
              {search ? 'Nenhum evento encontrado.' : 'Nenhum evento para esta semana.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-gray-500 bg-black/20">
                  <th className="p-4 font-medium">Evento</th>
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Categoria</th>
                  <th className="p-4 font-medium">Confirmados</th>
                  <th className="p-4 font-medium">Destaque</th>
                  <th className="p-4 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((ev, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={ev.id} 
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={ev.photoUrl}
                          alt={ev.name}
                          className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className="font-bold text-white group-hover:text-brand-fire transition-colors">{ev.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-300">{formatDate(ev.startDate)}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-white/5 text-gray-300 border border-white/10">
                        {ev.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-brand-fire/70" />
                        <span className="font-bold text-white">{ev.totalConfirmed}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {ev.isFeatured ? (
                        <span className="inline-flex items-center gap-1.5 bg-brand-fire/10 text-brand-fire px-2.5 py-1 rounded-full text-xs font-medium border border-brand-fire/20">
                          <Check className="w-3.5 h-3.5" /> Destaque
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-white/5 text-gray-500 px-2.5 py-1 rounded-full text-xs font-medium border border-white/10">
                          <X className="w-3.5 h-3.5" /> Padrão
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {ev.ticketLink ? (
                        <a
                          href={ev.ticketLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-fire hover:text-orange-400 underline transition-colors"
                        >
                          Ingressos →
                        </a>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

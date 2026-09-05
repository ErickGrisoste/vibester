import { useState } from 'react';
import { Search, MoreVertical, CheckCircle2, XCircle, Clock } from 'lucide-react';

const mockReservations = [
  { id: 'RES-001', name: 'Ana Clara', size: 4, type: 'Mesa VIP', status: 'confirmed', time: 'Hoje, 22:30', avatar: 'https://i.pravatar.cc/150?u=ana' },
  { id: 'RES-002', name: 'Marcos Silva', size: 2, type: 'Camarote', status: 'pending', time: 'Hoje, 23:00', avatar: 'https://i.pravatar.cc/150?u=marcos' },
  { id: 'RES-003', name: 'Julia Costa', size: 8, type: 'Aniversário', status: 'confirmed', time: 'Amanhã, 21:00', avatar: 'https://i.pravatar.cc/150?u=julia' },
  { id: 'RES-004', name: 'Pedro Santos', size: 3, type: 'Pista', status: 'cancelled', time: 'Hoje, 20:00', avatar: 'https://i.pravatar.cc/150?u=pedro' },
];

export default function ReservationsTable() {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = mockReservations.filter(res => 
    res.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    res.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="glass-panel rounded-2xl p-6 flex flex-col w-full mt-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">Reservas & VIPs</h3>
          <p className="text-sm text-gray-400">Gerencie as entradas e camarotes da noite.</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500" />
          </div>
          <input
            type="text"
            className="w-full bg-bg-dark border border-border-subtle text-sm text-gray-300 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-brand-fire transition-colors"
            placeholder="Buscar nome ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-gray-500">
              <th className="pb-3 font-medium px-4">Cliente</th>
              <th className="pb-3 font-medium px-4">Reserva</th>
              <th className="pb-3 font-medium px-4">Tipo</th>
              <th className="pb-3 font-medium px-4">Status</th>
              <th className="pb-3 font-medium text-right px-4">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filtered.map((res) => (
              <tr key={res.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <img src={res.avatar} alt={res.name} className="w-8 h-8 rounded-full border border-border-subtle" />
                    <div>
                      <p className="text-white font-medium group-hover:text-brand-fire transition-colors">{res.name}</p>
                      <p className="text-xs text-gray-500">{res.id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 text-gray-300">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-gray-500" />
                    {res.time}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className="text-gray-300">{res.type}</span>
                  <span className="text-xs text-gray-500 block">{res.size} pessoas</span>
                </td>
                <td className="py-4 px-4">
                  {res.status === 'confirmed' && (
                    <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 px-2.5 py-1 rounded-full text-xs font-medium border border-green-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmado
                    </span>
                  )}
                  {res.status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 px-2.5 py-1 rounded-full text-xs font-medium border border-yellow-500/20">
                      <Clock className="w-3.5 h-3.5" /> Pendente
                    </span>
                  )}
                  {res.status === 'cancelled' && (
                    <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full text-xs font-medium border border-red-500/20">
                      <XCircle className="w-3.5 h-3.5" /> Cancelado
                    </span>
                  )}
                </td>
                <td className="py-4 px-4 text-right">
                  <button className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">
                  Nenhuma reserva encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

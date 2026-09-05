import { Bell, Plus, LogOut, Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Topbar() {
  const { establishment, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-20 border-b border-border-subtle bg-bg-dark/80 backdrop-blur-lg flex items-center justify-between px-8 z-10 sticky top-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          {establishment?.name ?? 'Visão Geral'} <span className="text-2xl">🔥</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {establishment?.category ? `${establishment.category} · ` : ''}Acompanhe o fluxo e o calor do seu espaço.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/events')}
          className="bg-brand-fire hover:bg-[#ff571a] text-white px-5 py-2.5 rounded-full font-medium transition-all duration-300 shadow-[0_0_20px_rgba(255,69,0,0.4)] hover:shadow-[0_0_30px_rgba(255,69,0,0.6)] flex items-center gap-2 transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>Criar Evento</span>
        </button>

        <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
          <Bell className="w-6 h-6" />
          <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-brand-fire rounded-full shadow-[0_0_8px_rgba(255,69,0,0.8)] border-2 border-bg-dark"></span>
        </button>

        <div
          onClick={() => navigate('/select-establishment')}
          title="Trocar estabelecimento"
          className="h-10 w-10 rounded-full border border-border-subtle overflow-hidden bg-bg-card hover:border-brand-fire transition-colors cursor-pointer flex items-center justify-center"
        >
          {establishment?.photoUrl ? (
            <img src={establishment.photoUrl} alt={establishment.name} className="w-full h-full object-cover" />
          ) : (
            <Store className="w-5 h-5 text-gray-400" />
          )}
        </div>

        <button
          onClick={handleLogout}
          title="Sair"
          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

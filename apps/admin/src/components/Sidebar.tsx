import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, BarChart3, Users, Settings, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import VibesterLogo from '../assets/VIBESTER.svg';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: CalendarDays, label: 'Eventos & Promos', path: '/events' },
  { icon: BarChart3, label: 'Analytics da Noite', path: '/analytics' },
  { icon: Users, label: 'VIP List', path: '/vip' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 border-r border-border-subtle bg-bg-card flex flex-col glass-panel z-10">
      <div className="h-20 flex items-center px-6 border-b border-border-subtle">
        <img src={VibesterLogo} alt="Vibester" className="h-8" />
      </div>
      
      <nav className="flex-1 py-8 px-4 flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-300 ease-out group relative overflow-hidden",
                isActive 
                  ? "bg-brand-fire/10 text-brand-fire glow-border border border-brand-fire/50 shadow-[0_0_15px_rgba(255,69,0,0.1)]" 
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className={cn("w-5 h-5 mr-3 transition-colors duration-300")} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border-subtle">
        <NavLink
          to="/login"
          className="flex items-center px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-300"
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span className="font-medium">Sair</span>
        </NavLink>
      </div>
    </aside>
  );
}

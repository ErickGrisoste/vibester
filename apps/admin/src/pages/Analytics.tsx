import { motion } from 'framer-motion';
import { Users, Clock, DollarSign, Activity, BarChart2 } from 'lucide-react';
import VibeFlowChart from '../components/VibeFlowChart';

export default function Analytics() {
  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight">Analytics da Noite</h2>
        <p className="text-gray-400 mt-1">Dados demográficos, retenção e histórico de vibração.</p>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ticket Médio', value: 'R$ 85', icon: DollarSign, trend: '+12%' },
          { label: 'Tempo de Permanência', value: '3h 40m', icon: Clock, trend: '+5%' },
          { label: 'Retenção (Voltam)', value: '68%', icon: Users, trend: '-2%' },
          { label: 'Pico de Energia', value: '01:30', icon: Activity, trend: 'Estável' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          const isPositive = stat.trend.startsWith('+');
          const isNegative = stat.trend.startsWith('-');
          return (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel p-5 rounded-xl border-white/5 hover:border-brand-fire/20 transition-colors group"
            >
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm text-gray-400">{stat.label}</p>
                <Icon className="w-4 h-4 text-gray-500 group-hover:text-brand-fire transition-colors" />
              </div>
              <h4 className="text-2xl font-bold text-white">{stat.value}</h4>
              <p className={`text-xs mt-2 font-medium ${
                isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-500'
              }`}>
                {stat.trend} em 30 dias
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Demográfico (Simulado) */}
        <div className="glass-panel rounded-2xl p-6 border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="w-5 h-5 text-brand-fire" />
            <h3 className="text-lg font-bold text-white">Demografia do Público</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 font-medium">18-24 anos (Universitários)</span>
                <span className="text-white font-bold">55%</span>
              </div>
              <div className="w-full bg-bg-dark rounded-full h-2">
                <motion.div initial={{ width: 0 }} animate={{ width: '55%' }} transition={{ duration: 1 }} className="bg-brand-fire h-2 rounded-full shadow-[0_0_8px_rgba(255,69,0,0.8)]"></motion.div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 font-medium">25-34 anos</span>
                <span className="text-white font-bold">30%</span>
              </div>
              <div className="w-full bg-bg-dark rounded-full h-2">
                <motion.div initial={{ width: 0 }} animate={{ width: '30%' }} transition={{ duration: 1, delay: 0.2 }} className="bg-orange-400 h-2 rounded-full"></motion.div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 font-medium">35+ anos</span>
                <span className="text-white font-bold">15%</span>
              </div>
              <div className="w-full bg-bg-dark rounded-full h-2">
                <motion.div initial={{ width: 0 }} animate={{ width: '15%' }} transition={{ duration: 1, delay: 0.4 }} className="bg-gray-500 h-2 rounded-full"></motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Histórico Recente de Fluxo */}
        <div className="glass-panel rounded-2xl p-6 border-white/5">
           <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white">Consistência de Lotação</h3>
          </div>
          <p className="text-sm text-gray-400 mb-6">Média das últimas 4 semanas</p>
          <VibeFlowChart />
        </div>
      </div>
    </div>
  );
}

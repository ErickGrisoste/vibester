import { Users, Eye, TrendingUp, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import VibeFlowChart from '../components/VibeFlowChart';
import LatestPosts from '../components/LatestPosts';
import ReservationsTable from '../components/ReservationsTable';

export default function Dashboard() {
  return (
    <div className="space-y-8 pb-10">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1: Termômetro (Lotação) */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-panel rounded-2xl p-6 relative overflow-hidden group border-brand-fire/20"
        >
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-brand-fire/10 rounded-full blur-[40px] group-hover:bg-brand-fire/20 transition-all duration-500"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium">Lotação Atual</p>
              <h3 className="text-3xl font-bold text-white mt-1 flex items-center gap-2">
                85% <Zap className="w-5 h-5 text-brand-fire" fill="#FF4500" />
              </h3>
            </div>
            <div className="p-3 bg-brand-fire/10 rounded-xl">
              <Users className="w-6 h-6 text-brand-fire" />
            </div>
          </div>
          
          <div className="w-full bg-bg-dark rounded-full h-2.5 mt-4 border border-white/5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "85%" }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="bg-gradient-to-r from-orange-500 to-brand-fire h-2.5 rounded-full shadow-[0_0_10px_rgba(255,69,0,0.8)]"
            ></motion.div>
          </div>
          <p className="text-xs text-brand-fire mt-3 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-fire animate-pulse"></span>
            Aqueçendo rápido. Prepare o bar.
          </p>
        </motion.div>

        {/* KPI 2: Check-ins Hoje */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-panel rounded-2xl p-6 relative overflow-hidden group"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium">Check-ins Hoje</p>
              <h3 className="text-3xl font-bold text-white mt-1">142</h3>
            </div>
            <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
              <TrendingUp className="w-6 h-6 text-gray-300" />
            </div>
          </div>
          <p className="text-xs text-green-400 mt-6 font-medium flex items-center gap-1">
            +12% em relação a sexta passada
          </p>
        </motion.div>

        {/* KPI 3: Views no Perfil */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-panel rounded-2xl p-6 relative overflow-hidden group"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium">Visualizações do Perfil</p>
              <h3 className="text-3xl font-bold text-white mt-1">1.2k</h3>
            </div>
            <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
              <Eye className="w-6 h-6 text-gray-300" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-6 font-medium">
            Últimas 24 horas no radar
          </p>
        </motion.div>
      </div>

      {/* Row 2: Charts & Lists (70/30 Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (70%) */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-white">Fluxo da Vibe</h3>
            <select className="bg-bg-dark border border-border-subtle text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-fire">
              <option>Hoje</option>
              <option>Ontem</option>
              <option>Sexta Passada</option>
            </select>
          </div>
          <p className="text-sm text-gray-400 mb-8">Horários de pico e volume de check-ins no seu estabelecimento.</p>
          
          <VibeFlowChart />
        </div>

        {/* Right Side (30%) */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-white">Promoções Ativas</h3>
            <button className="text-sm text-brand-fire hover:text-orange-400 font-medium transition-colors">Ver todas</button>
          </div>
          <p className="text-sm text-gray-400 mb-2">O que está rolando agora.</p>
          
          <div className="flex-1 overflow-y-auto">
            <LatestPosts />
          </div>
        </div>
      </div>

      {/* Row 3: Data Table */}
      <ReservationsTable />
    </div>
  );
}

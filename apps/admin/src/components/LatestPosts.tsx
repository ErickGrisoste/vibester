import { Play, Pause, Edit3 } from 'lucide-react';

const posts = [
  { id: 1, title: 'Double Chopp até 22h', type: 'Promo Relâmpago', status: 'active', time: 'Ativo agora' },
  { id: 2, title: 'DJ Set Especial: Techno', type: 'Evento', status: 'scheduled', time: 'Hoje, 23:00' },
  { id: 3, title: 'VIP para Universitários', type: 'Lista VIP', status: 'paused', time: 'Pausado' },
];

export default function LatestPosts() {
  return (
    <div className="space-y-4 mt-6">
      {posts.map((post) => (
        <div key={post.id} className="group relative bg-white/5 border border-white/5 hover:border-brand-fire/30 rounded-xl p-4 transition-all duration-300 overflow-hidden">
          {post.status === 'active' && (
            <div className="absolute top-0 left-0 w-1 h-full bg-brand-fire shadow-[0_0_10px_rgba(255,69,0,0.8)]"></div>
          )}
          
          <div className="flex justify-between items-start">
            <div>
              <span className={`text-xs font-bold uppercase tracking-wider ${
                post.status === 'active' ? 'text-brand-fire' : 'text-gray-500'
              }`}>
                {post.type}
              </span>
              <h4 className="text-white font-medium mt-1 group-hover:text-brand-fire transition-colors">{post.title}</h4>
              <p className="text-sm text-gray-400 mt-1">{post.time}</p>
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
              {post.status === 'active' ? (
                <button className="p-1.5 bg-brand-fire/20 hover:bg-brand-fire/40 text-brand-fire rounded-md transition-colors">
                  <Pause className="w-4 h-4" />
                </button>
              ) : (
                <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white transition-colors">
                  <Play className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

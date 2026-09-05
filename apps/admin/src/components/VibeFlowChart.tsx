import { motion } from 'framer-motion';

const data = [
  { time: '18h', value: 10 },
  { time: '19h', value: 25 },
  { time: '20h', value: 45 },
  { time: '21h', value: 65 },
  { time: '22h', value: 85 },
  { time: '23h', value: 100 }, // Peak
  { time: '00h', value: 95 },
  { time: '01h', value: 80 },
  { time: '02h', value: 50 },
  { time: '03h', value: 20 },
];

export default function VibeFlowChart() {
  return (
    <div className="h-64 mt-6 flex items-end justify-between gap-2 px-2">
      {data.map((item, index) => {
        // Calculate percentage height
        const heightPercent = `${item.value}%`;
        const isPeak = item.value > 80;

        return (
          <div key={item.time} className="flex flex-col items-center flex-1 group">
            <div className="relative w-full flex justify-center h-48 items-end rounded-t-sm">
              {/* Tooltip on hover */}
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white text-bg-dark text-xs font-bold py-1 px-2 rounded pointer-events-none z-10 shadow-lg">
                {item.value}%
              </div>
              
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: heightPercent }}
                transition={{ duration: 0.8, delay: index * 0.05, ease: "easeOut" }}
                className={`w-full max-w-[40px] rounded-t-md transition-colors duration-300 ${
                  isPeak ? 'bg-gradient-to-t from-brand-fire/40 to-brand-fire shadow-[0_0_15px_rgba(255,69,0,0.5)]' : 'bg-white/10 group-hover:bg-white/20'
                }`}
              ></motion.div>
            </div>
            <span className="text-xs text-gray-500 mt-3 font-medium">{item.time}</span>
          </div>
        );
      })}
    </div>
  );
}

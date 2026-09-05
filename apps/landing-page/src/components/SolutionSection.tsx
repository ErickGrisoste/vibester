"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";
import PhoneMockup from "./PhoneMockup";

/* ─────────────────────────────────────────────
   Dados das 4 etapas
   ───────────────────────────────────────────── */
const STEPS = [
  {
    id: 0,
    step: "01",
    title: "Em Alta",
    subtitle: "Heatmap",
    description:
      "Chega de viagens perdidas! Nosso termômetro mostra em tempo real a lotação e a vibe de cada local perto de você.",
    accent: "#FF4500",
    accentLight: "#FF6B00",
  },
  {
    id: 1,
    step: "02",
    title: "Vibe Check",
    subtitle: "Stories da Noite",
    description:
      "Assista aos vídeos em tempo real que seus amigos postaram e veja a vibe do rolê.",
    accent: "#FF6B00",
    accentLight: "#FF8C00",
  },
  {
    id: 2,
    step: "03",
    title: "O Alvo Marcado",
    subtitle: "Na Direção Certa",
    description:
      "Escolha a vibe que combine com você! Vá com a certeza absoluta de que a viagem não será perdida.",
    accent: "#FFA500",
    accentLight: "#FFB800",
  },
];

/* ─────────────────────────────────────────────
   Animação dos textos flutuantes
   ───────────────────────────────────────────── */
const floatingTextVariants = {
  enter: {
    x: -200,
    y: 50,
    opacity: 0,
    filter: "blur(12px)",
    scale: 0.93,
  },
  center: {
    x: 0,
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    x: -140,
    y: -70,
    opacity: 0,
    filter: "blur(10px)",
    scale: 0.95,
    transition: { duration: 0.5, ease: [0.55, 0, 1, 0.45] as const },
  },
};

const screenVariants = {
  enter: { opacity: 0, scale: 1.06, filter: "blur(8px)" },
  center: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    filter: "blur(8px)",
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/* ═══════════════════════════════════════════════
   SolutionSection

   Arquitetura FINAL — Um único elemento, zero duplicação:
   - A seção tem 300vh de altura (scroll space)
   - Dentro dela, UM ÚNICO container com sticky top-0 h-screen
   - O container scrolla naturalmente com a página até chegar
     no topo, aí ele TRAVA (sticky) durante 200vh de scroll
   - Dentro do container: grid 50/50 com textos animados à
     esquerda e celular à direita
   - Quando a seção acaba, o container "solta" e continua
     scrollando normalmente
   ═══════════════════════════════════════════════ */
export default function SolutionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Parallax + tilt dinâmico no celular
  // Cada step o celular inclina pra um lado, alternando
  const phoneY = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [15, -10, 12]
  );
  const phoneRotateY = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [-5, 4, -4]
  );
  // Tilt lateral: inclina pra esquerda no step 1, direita no step 2, etc.
  const phoneRotateZ = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [-3, 2.5, -2.5]
  );
  // Tilt pra frente/trás sutil
  const phoneRotateX = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [3, -2, 2]
  );

  // Atualiza step ativo
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const step = Math.min(2, Math.max(0, Math.floor(v * 3)));
    setActiveStep(step);
  });

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative bg-[#050505]"
      style={{ height: "300vh" }}
    >
      {/* ══════════════════════════════════════════════
          CONTAINER STICKY — Um único elemento
          Scrolla naturalmente, trava no topo, solta no fim.
          ══════════════════════════════════════════════ */}
      <div className="sticky top-0 h-screen w-full flex items-center z-10">

        {/* Glow de fundo */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute top-1/3 left-1/3 w-[800px] h-[800px] rounded-full -translate-x-1/2 -translate-y-1/2"
            animate={{
              background: `radial-gradient(circle, ${STEPS[activeStep].accent}10 0%, transparent 55%)`,
            }}
            transition={{ duration: 1 }}
            style={{ filter: "blur(130px)" }}
          />
        </div>

        {/* ── Grid 50/50: Textos | Celular ── */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 lg:px-16 xl:px-20 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* ═══ ESQUERDA: Textos Flutuantes ═══ */}
          <div className="flex flex-col justify-center order-2 lg:order-1">

            {/* Título da seção (fixo, sempre visível) */}
            <div className="mb-8 space-y-4">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FF4500]/10 border border-[#FF4500]/20 text-[#FF4500] text-xs font-bold tracking-[0.25em] uppercase">
                <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse" />
                Como Funciona
              </span>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tighter leading-[0.95]">
                3 passos pra <br />
                <span className="text-gradient-fire">nunca mais errar</span> o rolê
              </h2>
            </div>

            {/* Conteúdo dinâmico do step — AnimatePresence */}
            <div className="relative min-h-[200px] lg:min-h-[220px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  variants={floatingTextVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 flex flex-col gap-4"
                >
                  {/* Badge do step */}
                  <div className="flex items-center gap-4">
                    <motion.div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: STEPS[activeStep].accent,
                        boxShadow: `0 0 20px ${STEPS[activeStep].accent}`,
                      }}
                      animate={{ scale: [1, 1.25, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span className="text-zinc-500 text-sm font-bold tracking-[0.3em] uppercase">
                      {STEPS[activeStep].step}
                    </span>
                    <span
                      className="text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full border"
                      style={{
                        color: STEPS[activeStep].accentLight,
                        borderColor: `${STEPS[activeStep].accent}30`,
                        backgroundColor: `${STEPS[activeStep].accent}08`,
                      }}
                    >
                      {STEPS[activeStep].subtitle}
                    </span>
                  </div>

                  {/* Título */}
                  <h3
                    className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight"
                    style={{ color: STEPS[activeStep].accent }}
                  >
                    {STEPS[activeStep].title}
                  </h3>

                  {/* Descrição */}
                  <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-lg font-medium">
                    {STEPS[activeStep].description}
                  </p>

                  {/* Linhas decorativas animadas */}
                  <div className="flex items-center gap-3 pt-1">
                    <motion.div
                      className="h-[2px] rounded-full"
                      style={{ backgroundColor: STEPS[activeStep].accent }}
                      initial={{ width: 0 }}
                      animate={{ width: 48 }}
                      transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                    />
                    <motion.div
                      className="h-[2px] rounded-full opacity-40"
                      style={{ backgroundColor: STEPS[activeStep].accent }}
                      initial={{ width: 0 }}
                      animate={{ width: 24 }}
                      transition={{ duration: 0.4, delay: 0.45, ease: "easeOut" }}
                    />
                    <motion.div
                      className="h-[2px] rounded-full opacity-20"
                      style={{ backgroundColor: STEPS[activeStep].accent }}
                      initial={{ width: 0 }}
                      animate={{ width: 12 }}
                      transition={{ duration: 0.35, delay: 0.55, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Dots de progresso */}
            <div className="flex items-center gap-3 mt-4">
              {STEPS.map((_, idx) => (
                <motion.div
                  key={idx}
                  className="h-1.5 rounded-full"
                  animate={{
                    width: idx === activeStep ? 32 : 10,
                    backgroundColor:
                      idx === activeStep
                        ? STEPS[activeStep].accent
                        : `${STEPS[activeStep].accent}25`,
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              ))}
            </div>
          </div>

          {/* ═══ DIREITA: Celular com Parallax ═══ */}
          <div className="flex items-center justify-center order-1 lg:order-2" style={{ perspective: 1000 }}>
            <motion.div
              style={{
                y: phoneY,
                rotateX: phoneRotateX,
                rotateY: phoneRotateY,
                rotateZ: phoneRotateZ,
                transformStyle: "preserve-3d",
              }}
              className="relative"
            >
              {/* Glow dinâmico atrás do celular */}
              <motion.div
                className="absolute -inset-[30%] rounded-full pointer-events-none -z-10"
                animate={{
                  background: `radial-gradient(circle, ${STEPS[activeStep].accent}18 0%, transparent 60%)`,
                }}
                transition={{ duration: 0.8 }}
                style={{ filter: "blur(80px)" }}
              />

              {/* O ÚNICO celular — sticky junto com todo o conteúdo */}
              <PhoneMockup>
                <AnimatePresence mode="wait">
                  {activeStep === 0 && <ScreenRadar />}
                  {activeStep === 1 && <ScreenVibeCheck />}
                  {activeStep === 2 && <ScreenVambora />}
                </AnimatePresence>
              </PhoneMockup>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════
   Telas do celular
   ═══════════════════════════════════════════════ */

function ScreenRadar() {
  return (
    <motion.div
      key="s0"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="absolute inset-0 bg-[#0a0a0a] overflow-hidden"
    >
      {/* Screenshot real do app Vibester — tela "Em Alta" */}
      <img
        src="/screen-em-alta.png"
        alt="Vibester — Populares Agora"
        className="w-full h-full object-cover object-top"
      />
    </motion.div>
  );
}

function ScreenVibeCheck() {
  return (
    <motion.div
      key="s1"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="absolute inset-0 bg-gradient-to-b from-[#1a0a05] to-[#050505]"
    >
      <div className="absolute inset-0 opacity-60" style={{ background: "linear-gradient(135deg, #1a0510 0%, #0d0805 40%, #120a15 100%)" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      <div className="absolute top-[20%] left-[15%] w-24 h-24 bg-purple-600/30 blur-3xl rounded-full" />
      <div className="absolute bottom-[30%] right-[10%] w-20 h-20 bg-orange-500/25 blur-2xl rounded-full" />
      <div className="absolute top-[50px] left-4 right-4 flex gap-1 z-10">
        {[1, 0.3, 0.3].map((opacity, i) => (
          <div key={i} className="h-[2px] flex-1 bg-white rounded-full" style={{ opacity }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col justify-between p-4 pt-[66px] pb-6 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B00] to-[#FF4500] flex items-center justify-center text-sm shadow-lg">🎤</div>
          <div>
            <p className="text-white text-[10px] font-bold">Mister Rock Bar</p>
            <p className="text-zinc-400 text-[8px]">Agora · Ao Vivo</p>
          </div>
        </div>
        <div className="text-center space-y-3">
          <p className="text-white text-2xl font-black drop-shadow-lg">Tá Lotado! 🔥</p>
          <p className="text-[#FFB08A] text-sm font-bold drop-shadow-lg leading-tight">A vibe tá insana, cheguem logo</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white text-[9px] font-bold">↑ 1.2k viram isso</span>
          <span className="px-3 py-1 rounded-full bg-[#FF6B00]/80 text-white text-[9px] font-bold shadow-lg">Ir Agora →</span>
        </div>
      </div>
    </motion.div>
  );
}



function ScreenVambora() {
  return (
    <motion.div
      key="s2"
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="absolute inset-0 bg-[#0a0a0a] p-4 flex flex-col gap-3"
    >
      <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest px-1">Destinos em Alta</p>
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/5 shadow-lg">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a0e08 0%, #0a0505 50%, #0f0a12 100%)" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
        <div className="absolute top-[10%] right-[10%] w-32 h-32 bg-orange-600/15 blur-3xl rounded-full" />
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white font-black text-xl tracking-tight leading-none">Oficina</p>
              <p className="text-white font-black text-xl tracking-tight">PUB</p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm text-[#FFA500] text-sm font-black border border-[#FFA500]/20">98%</span>
          </div>
          <div className="space-y-3">
            <p className="text-zinc-400 text-[10px] font-medium">Rock • Drinks • 2.4km</p>
            <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF4500] to-[#FFA500] text-white text-[11px] font-black uppercase tracking-wider shadow-[0_0_20px_rgba(255,69,0,0.4)]">
              Tô Indo! 🔥
            </button>
          </div>
        </div>
      </div>
      <div className="relative h-[72px] rounded-2xl overflow-hidden border border-white/5 opacity-50">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0808] to-[#0a050a]" />
        <div className="relative z-10 p-3 flex items-end h-full justify-between">
          <div>
            <p className="text-white font-black text-sm">Night Market</p>
            <p className="text-zinc-500 text-[9px]">4.1km</p>
          </div>
          <span className="text-[#FF8C00] text-xs font-black">81% 🔥</span>
        </div>
      </div>
    </motion.div>
  );
}

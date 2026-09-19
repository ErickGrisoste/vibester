"use client";

import { useState, useRef, useEffect } from "react";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    
    try {
      const response = await fetch("https://formspree.io/f/mzdlpdav", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setIsSuccess(true);
        setEmail("");
      } else {
        console.error("Erro ao enviar o formulário.");
      }
    } catch (error) {
      console.error("Erro de rede ao enviar o formulário:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const marqueeText =
    "A NOITE NUNCA MAIS SERÁ A MESMA • A NOITE NUNCA MAIS SERÁ A MESMA • A NOITE NUNCA MAIS SERÁ A MESMA • A NOITE NUNCA MAIS SERÁ A MESMA • ";

  return (
    <footer ref={footerRef} id="waitlist" className="relative overflow-hidden">
      {/* Marquee Section */}
      <div className="relative py-8 border-t border-b border-border overflow-hidden select-none">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />

        <div className="flex animate-[marquee_12s_linear_infinite] whitespace-nowrap">
          <span className="text-5xl sm:text-7xl lg:text-8xl font-black text-white/10 tracking-tighter mx-0">
            {marqueeText}
          </span>
          <span className="text-5xl sm:text-7xl lg:text-8xl font-black text-white/10 tracking-tighter mx-0">
            {marqueeText}
          </span>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative py-24 sm:py-32">
        {/* Background glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none">
          <div
            className="w-full h-full"
            style={{
              background:
                "radial-gradient(ellipse, rgba(255,107,0,0.1) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          {/* Icon */}
          <div
            className={`flex justify-center mb-6 transition-all duration-700 ${isVisible
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-75 blur-md"
              }`}
          >
            <img src="/mailvibester.svg" alt="Mail Icon" className="w-40 h-40 sm:w-52 sm:h-52 object-contain drop-shadow-[0_0_20px_rgba(255,69,0,0.5)]" />
          </div>

          {/* Title */}
          <h2
            className={`text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight transition-all duration-700 delay-100 ${isVisible
                ? "opacity-100 translate-y-0 blur-0"
                : "opacity-0 translate-y-6 blur-md"
              }`}
          >
            Chegou até aqui?
            <br />
            <span className="text-gradient-fire">Bora fechar.</span>
          </h2>

          {/* Subtitle */}
          <p
            className={`text-muted text-lg mb-10 transition-all duration-700 delay-200 ${isVisible
                ? "opacity-100 translate-y-0 blur-0"
                : "opacity-0 translate-y-6 blur-md"
              }`}
          >
            Seja um dos primeiros a receber acesso.
            <br />
            Sem spam. Só fogo. 🔥
          </p>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className={`flex flex-col sm:flex-row gap-3 max-w-md mx-auto transition-all duration-700 delay-300 ${isVisible
                ? "opacity-100 translate-y-0 blur-0"
                : "opacity-0 translate-y-6 blur-md"
              }`}
          >
            <input
              type="email"
              id="email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@email.com"
              required
              disabled={isLoading || isSuccess}
              className={`bg-surface-light border-border rounded-xl text-white placeholder:text-muted/50 focus:outline-none focus:border-fire/50 focus:ring-1 focus:ring-fire/20 transition-all duration-500 overflow-hidden text-sm disabled:opacity-50 ${
                isSuccess 
                  ? "w-0 flex-none opacity-0 border-0 p-0" 
                  : "flex-1 border px-5 py-4 w-full"
              }`}
            />
            <button
              type="submit"
              id="submit-btn"
              disabled={isLoading || isSuccess}
              className={`btn-fire py-4 rounded-xl whitespace-nowrap disabled:opacity-100 disabled:cursor-not-allowed transition-all duration-500 ${
                isSuccess ? "flex-1 px-4 sm:px-8 w-full" : "px-8"
              }`}
            >
              <span className="relative z-10 flex items-center justify-center w-full">
                {isLoading 
                  ? "Enviando..." 
                  : isSuccess 
                    ? "Você está na lista VIP 🔥" 
                    : "Quero Acesso"}
              </span>
            </button>
          </form>

          {/* Social proof */}
          <p
            className={`text-muted/50 text-xs mt-6 transition-all duration-700 delay-500 ${isVisible
                ? "opacity-100 blur-0"
                : "opacity-0 blur-md"
              }`}
          >
            +2.400 pessoas já estão na fila. Não fica pra trás.
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border py-8 px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <img src="/logo-vibester.svg" alt="Vibester" className="h-6 w-auto" />
          </div>
          <p className="text-muted/50 text-xs">
            © {new Date().getFullYear()} Vibester. Todos os direitos
            reservados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a
              href="/termos"
              className="text-muted/50 text-xs hover:text-fire transition-colors duration-300"
            >
              Termos
            </a>
            <a
              href="/privacidade"
              className="text-muted/50 text-xs hover:text-fire transition-colors duration-300"
            >
              Privacidade
            </a>
            <a
              href="/suporte"
              className="text-muted/50 text-xs hover:text-fire transition-colors duration-300"
            >
              Suporte
            </a>
            <a
              href="https://instagram.com/vibester.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted/50 text-xs hover:text-fire transition-colors duration-300"
            >
              Instagram
            </a>
            <a
              href="https://tiktok.com/vibester"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted/50 text-xs hover:text-fire transition-colors duration-300"
            >
              TikTok
            </a>
            <a
              href="https://x.com/vibester"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted/50 text-xs hover:text-fire transition-colors duration-300"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

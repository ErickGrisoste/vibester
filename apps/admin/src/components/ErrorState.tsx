import { motion } from 'framer-motion';
import { AlertTriangle, WifiOff, FileQuestion, ServerCrash, Lock, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  error: string | Error | null;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}

function sanitizeErrorMessage(msg: string): string {
  if (/route\s+(GET|POST|PUT|PATCH|DELETE):/i.test(msg)) {
    return 'O recurso solicitado não foi encontrado no servidor.';
  }
  let sanitized = msg.replace(/https?:\/\/[^\s]+/gi, '');
  sanitized = sanitized.replace(/\/api\/[^\s]+/gi, '');
  sanitized = sanitized.replace(/\(\d{3}\)/g, '').trim();
  return sanitized || 'Ocorreu um erro ao processar a solicitação.';
}

export function parseErrorDetails(err: string | Error | null) {
  const rawMessage = typeof err === 'string' ? err : err?.message ?? 'Ocorreu um erro inesperado.';
  
  let status: number | null = null;
  const statusMatch = rawMessage.match(/\b(400|401|403|404|409|422|429|500|502|503)\b/);
  if (statusMatch) {
    status = parseInt(statusMatch[1], 10);
  }

  const isNetwork = rawMessage.toLowerCase().includes('failed to fetch') || rawMessage.toLowerCase().includes('networkerror') || rawMessage.toLowerCase().includes('conexão');
  const isNotFound = status === 404 || rawMessage.toLowerCase().includes('not found') || rawMessage.toLowerCase().includes('não encontrad');
  const isAuth = status === 401 || status === 403 || rawMessage.toLowerCase().includes('unauthorized') || rawMessage.toLowerCase().includes('token');
  const isServer = status === 500 || status === 502 || status === 503 || rawMessage.toLowerCase().includes('server error') || rawMessage.toLowerCase().includes('indisponível');

  let title = 'Erro na Operação';
  let description = sanitizeErrorMessage(rawMessage);
  let Icon = AlertTriangle;
  let badgeText = status ? `HTTP ${status}` : 'Erro';

  if (isNetwork) {
    title = 'Conexão Indisponível';
    description = 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet ou se os serviços estão ativos.';
    Icon = WifiOff;
    badgeText = 'Sem Conexão';
  } else if (isNotFound) {
    title = 'Recurso Não Encontrado';
    description = 'O conteúdo ou registro solicitado não foi localizado no servidor.';
    Icon = FileQuestion;
    badgeText = 'Não Encontrado';
  } else if (isAuth) {
    title = 'Acesso Não Autorizado';
    description = 'Sua sessão expirou ou você não possui permissão para realizar esta ação.';
    Icon = Lock;
    badgeText = 'Não Autorizado';
  } else if (isServer) {
    title = 'Serviço Indisponível';
    description = 'Ocorreu uma instabilidade temporária no servidor. Tente novamente em alguns instantes.';
    Icon = ServerCrash;
    badgeText = `Instabilidade`;
  }

  return { title, description, rawMessage, Icon, badgeText, status };
}

export default function ErrorState({ error, onRetry, title: customTitle, compact = false }: ErrorStateProps) {
  if (!error) return null;

  const { title, description, Icon, badgeText } = parseErrorDetails(error);
  const displayTitle = customTitle || title;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 text-sm text-red-300"
      >
        <Icon className="w-5 h-5 text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-200">{displayTitle}</p>
          <p className="text-xs text-red-300/80 truncate">{description}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-2.5 py-1 text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full glass-panel rounded-2xl p-8 border-red-500/20 bg-red-500/[0.03] text-center relative overflow-hidden my-4"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/10 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
          <Icon className="w-7 h-7" />
        </div>

        <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-500/20 text-red-300 border border-red-500/30 mb-3 tracking-wide uppercase">
          {badgeText}
        </span>

        <h3 className="text-xl font-bold text-white mb-2">{displayTitle}</h3>
        
        <p className="text-gray-300 text-sm mb-6 leading-relaxed">
          {description}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-white font-semibold rounded-xl border border-red-500/40 transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>
        )}
      </div>
    </motion.div>
  );
}

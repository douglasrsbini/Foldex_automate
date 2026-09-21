import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  FolderPlus, 
  FolderSearch, 
  FlaskConical, 
  History, 
  Zap, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  CheckCircle2, 
  Layers,
  ArrowRight,
  FileText,
  FolderDown,
  ShieldCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OnboardingTourProps {
  accentColor: string;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

interface TourStepCore {
  tabTarget: string;
  icon: React.ElementType;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  accentColor,
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  // ⚡ Estado para simular as animações de clique e movimentação de arquivos em cada passo
  const [simState, setSimState] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    // Loop de animação interna para dar vida às simulações do tour (troca a cada 2.5 segundos)
    const timer = setInterval(() => {
      setSimState((prev) => (prev + 1) % 3);
    }, 2500);
    return () => clearInterval(timer);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const stepsCore: TourStepCore[] = [
    { tabTarget: 'builder', icon: Sparkles },
    { tabTarget: 'builder', icon: Layers },
    { tabTarget: 'builder', icon: FolderPlus },
    { tabTarget: 'builder', icon: Zap },
    { tabTarget: 'explorer', icon: FolderSearch },
    { tabTarget: 'dryrun', icon: FlaskConical },
    { tabTarget: 'history', icon: History },
  ];

  const currentStepCore = stepsCore[currentStep];
  const StepIcon = currentStepCore.icon;
  const isLast = currentStep === stepsCore.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      setSimState(0);
      onNavigateTab(stepsCore[nextIdx].tabTarget);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevIdx = currentStep - 1;
      setCurrentStep(prevIdx);
      setSimState(0);
      onNavigateTab(stepsCore[prevIdx].tabTarget);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('onboarding_tour_completed', 'true');
    onClose();
  };

  // ⚡ RENDERIZADOR DAS SIMULAÇÕES ANIMADAS POR PASSO
  const renderSimulatedScreen = () => {
    switch (currentStep) {
      case 0: // Visão Geral & Zero-Knowledge
        return (
          <div className="h-32 bg-slate-900/90 dark:bg-[#12161c] rounded-2xl p-3 border border-white/10 flex flex-col justify-between relative overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5 text-blue-400"><ShieldCheck size={13} /> Zero-Knowledge Protocol</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">100% Local</span>
            </div>
            <div className="space-y-1.5 my-auto">
              <div className="flex items-center justify-between bg-white/5 p-1.5 rounded-lg">
                <span className="text-slate-300">C:/Downloads/nota_fiscal.pdf</span>
                <span className="text-blue-400">Processando na Máquina...</span>
              </div>
              <div className="flex items-center justify-between bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                <span className="text-emerald-300">Criptografia SHA-256</span>
                <span className="text-emerald-400 font-bold">Seguro ✓</span>
              </div>
            </div>
          </div>
        );

      case 1: // 1-Click Smart Organize
        return (
          <div className="h-32 bg-slate-900/90 dark:bg-[#12161c] rounded-2xl p-3 border border-white/10 flex flex-col justify-between relative overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span>Auto-Organizar Pasta</span>
              <span className="text-blue-400 animate-pulse">⚡ 1 Clic</span>
            </div>
            <div className="flex items-center justify-center gap-3 my-auto">
              <div className={`p-2 rounded-xl bg-blue-500/20 text-blue-300 transition-all duration-500 ${simState === 1 ? 'scale-110 translate-x-2' : ''}`}>
                <FolderDown size={20} />
                <span className="text-[9px] block">Downloads</span>
              </div>
              <ArrowRight size={16} className="text-slate-500 animate-pulse" />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">/Documentos</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">/Planilhas</span>
              </div>
            </div>
          </div>
        );

      case 2: // Construtor de Regras Customizadas
        return (
          <div className="h-32 bg-slate-900/90 dark:bg-[#12161c] rounded-2xl p-3 border border-white/10 flex flex-col justify-between relative overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span>Filtros Dinâmicos</span>
              <span className="text-amber-400">AND / OR</span>
            </div>
            <div className="space-y-1.5 my-auto">
              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg">
                <span className="text-blue-400 font-bold">SE:</span>
                <span className="text-slate-300">Extensão É IGUAL A</span>
                <span className="text-emerald-400 bg-emerald-500/10 px-1.5 rounded">.pdf</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-lg">
                <span className="text-purple-400 font-bold">ENTÃO:</span>
                <span className="text-slate-300">Mover para</span>
                <span className="text-blue-300 bg-blue-500/10 px-1.5 rounded">/Contratos/{'{ano}'}</span>
              </div>
            </div>
          </div>
        );

      case 3: // Piloto Automático em Tempo Real (Sentinel)
        return (
          <div className="h-32 bg-slate-900/90 dark:bg-[#12161c] rounded-2xl p-3 border border-white/10 flex flex-col justify-between relative overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span>Sentinel em Segundo Plano</span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Ativo</span>
            </div>
            <div className="my-auto flex items-center justify-around text-center">
              <div className="bg-white/5 p-2 rounded-xl">
                <FileText size={18} className="text-blue-400 mx-auto mb-1" />
                <span className="text-[9px] text-slate-300">Novo Arquivo</span>
              </div>
              <div className="text-blue-400 font-bold text-lg animate-bounce">➔</div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-xl">
                <CheckCircle2 size={18} className="text-emerald-400 mx-auto mb-1" />
                <span className="text-[9px] text-emerald-300">Organizado Auto</span>
              </div>
            </div>
          </div>
        );

      case 4: // Explorador de Arquivos & Cofres
        return (
          <div className="h-32 bg-slate-900/90 dark:bg-[#12161c] rounded-2xl p-3 border border-white/10 flex flex-col justify-between relative overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span>Cofre AES-256 (.ZIP)</span>
              <span className="text-purple-400">Segurança Militar</span>
            </div>
            <div className="my-auto flex items-center justify-between bg-white/5 p-2 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">ZIP</div>
                <div>
                  <p className="text-white text-xs font-bold">Documentos_Sigilosos.zip</p>
                  <p className="text-[9px] text-slate-400">Protegido por Senha • AES-256</p>
                </div>
              </div>
              <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-lg font-bold">Cifrado ✓</span>
            </div>
          </div>
        );

      case 5: // Simulação Segura (Dry-Run)
        return (
          <div className="h-32 bg-slate-900/90 dark:bg-[#12161c] rounded-2xl p-3 border border-white/10 flex flex-col justify-between relative overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span>Simulação (Dry-Run)</span>
              <span className="text-blue-400">Previsibilidade 100%</span>
            </div>
            <div className="space-y-1.5 my-auto">
              <div className="flex items-center justify-between bg-white/5 p-1.5 rounded-lg text-[10px]">
                <span className="text-slate-400">De: /Downloads/balanco.xlsx</span>
                <span className="text-blue-400">➔ Para: /Financeiro/2026/</span>
              </div>
              <div className="text-center text-[10px] text-emerald-400 font-bold bg-emerald-500/10 py-1 rounded">
                Simulação validada: 0 conflitos encontrados.
              </div>
            </div>
          </div>
        );

      case 6: // Auditoria Forense & Rollback
        return (
          <div className="h-32 bg-slate-900/90 dark:bg-[#12161c] rounded-2xl p-3 border border-white/10 flex flex-col justify-between relative overflow-hidden font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
              <span>Trilha Forense SHA-256</span>
              <span className="text-emerald-400">Anti-Fraude</span>
            </div>
            <div className="my-auto space-y-1">
              <div className="flex items-center justify-between text-[10px] bg-white/5 p-1.5 rounded">
                <span className="text-slate-300">Lote #849 - Reverter</span>
                <span className="text-emerald-400 font-bold underline cursor-pointer">1-Click Rollback ↺</span>
              </div>
              <p className="text-[9px] text-slate-400 text-center">Operador: Windows_User • Assinatura Válida</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-300">
      
      {/* Container com Liquid Glass (Vidro Fosco Real) */}
      <div 
        className="bg-white/85 dark:bg-[#12161c]/85 w-full max-w-xl rounded-3xl border border-white/40 dark:border-white/15 shadow-2xl overflow-hidden flex flex-col backdrop-blur-2xl saturate-150 relative"
        style={{ fontFamily: "'Quicksand', sans-serif" }}
      >
        
        {/* Cabeçalho do Card */}
        <div className="p-5 border-b border-slate-200/50 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              <StepIcon size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {t('tour.step_prefix')} {currentStep + 1} {t('tour.of')} {stepsCore.length}
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight" style={{ fontFamily: "'Varela Round', sans-serif" }}>
                {t(`tour.steps.${currentStep}.title`)}
              </h3>
            </div>
          </div>

          <button 
            onClick={handleFinish}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
            title={t('tour.btn_skip')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo Central com a Simulação Animada */}
        <div className="p-6 space-y-4">
          
          {/* ⚡ SIMULADOR VISUAL ANIMADO DA TELA */}
          {renderSimulatedScreen()}

          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200" style={{ fontFamily: "'Varela Round', sans-serif" }}>
              {t(`tour.steps.${currentStep}.subtitle`)}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(`tour.steps.${currentStep}.description`)}
            </p>
          </div>

          <div className="p-4 bg-slate-100/70 dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/10 space-y-2 backdrop-blur-md">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              {t('tour.highlights_title')}
            </span>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>{t(`tour.steps.${currentStep}.h1`)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>{t(`tour.steps.${currentStep}.h2`)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>{t(`tour.steps.${currentStep}.h3`)}</span>
              </div>
            </div>
          </div>

          {/* Indicadores de Etapa (Bolinhas) */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {stepsCore.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentStep(idx);
                  setSimState(0);
                  onNavigateTab(stepsCore[idx].tabTarget);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStep 
                    ? 'w-6 bg-blue-600' 
                    : 'w-1.5 bg-slate-300 dark:bg-white/20 hover:bg-slate-400'
                }`}
                style={idx === currentStep ? { backgroundColor: accentColor } : {}}
              />
            ))}
          </div>
        </div>

        {/* Rodapé de Navegação */}
        <div className="p-4 bg-slate-50/80 dark:bg-[#0f141a]/80 border-t border-slate-200/50 dark:border-white/10 flex items-center justify-between backdrop-blur-xl">
          <button
            onClick={handleFinish}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold underline"
          >
            {t('tour.btn_skip')}
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-4 py-2 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/15 flex items-center gap-1.5 transition-colors shadow-xs backdrop-blur-md"
              >
                <ChevronLeft size={14} /> {t('tour.btn_prev')}
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md transition-transform active:scale-95 flex items-center gap-1.5"
              style={{ backgroundColor: accentColor }}
            >
              <span>{isLast ? t('tour.btn_finish') : t('tour.btn_next')}</span>
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
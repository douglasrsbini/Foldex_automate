import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ⚡ Óculos Mágicos
// ⚡ IMPORTAÇÃO BLINDADA PARA O BUILD
import appIcon from '../assets/app-icon.png';

interface SplashScreenProps {
  onFinish: () => void;
  accentColor: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, accentColor }) => {
  const { t } = useTranslation(); // ⚡ Instância ativada

  const [progress, setProgress] = useState(15);
  // O estado inicial já puxa a tradução do primeiro passo
  const [statusMessage, setStatusMessage] = useState(t('splash.init'));
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    console.log('📢 [SplashScreen] Mounted');
    // Array de passos dinâmico com o tradutor embutido
    const steps = [
      { p: 35, msg: t('splash.db') },
      { p: 65, msg: t('splash.rules') },
      { p: 85, msg: t('splash.integrity') },
      { p: 100, msg: t('splash.ready') },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].p);
        setStatusMessage(steps[currentStep].msg);
        currentStep++;
      } else {
        clearInterval(interval);
        console.log('📢 [SplashScreen] Fading out');
        setTimeout(() => setFadeOut(true), 300);
        setTimeout(() => {
          console.log('📢 [SplashScreen] Calling onFinish()');
          onFinish();
        }, 700);
      }
    }, 280);

    return () => {
      console.log('📢 [SplashScreen] Unmounted');
      clearInterval(interval);
    };
  }, [onFinish, t]); // 't' adicionado como dependência para segurança do React

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-10 bg-[#0e0e11] text-white select-none transition-opacity duration-500 ${
      fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      <div />

      {/* Centro: Logo Oficial Pasta + Raio (Estilo Barra de Tarefas) */}
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* ⚡ AQUI: Ícone do app no SplashScreen renderizado via variável */}
          <img 
            src={appIcon} 
            alt="Foldex Automate Logo" 
            className="w-full h-full object-contain drop-shadow-2xl" 
          />
        </div>

        <div className="flex flex-col items-center space-y-1 text-center">
          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white">FOLDEX AUTOMATE</h1>
          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
            {t('splash.subtitle')}
          </span>
        </div>

        <div className="w-64 space-y-2 pt-2">
          <div className="w-full h-1.5 bg-[#1f1f26] rounded-full overflow-hidden border border-[#2e2e38]">
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>
          <p className="text-[11px] font-mono text-slate-400 text-center truncate">
            {statusMessage}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
        <ShieldCheck size={14} className="text-green-500" />
        <span>{t('splash.footer')}</span>
      </div>
    </div>
  );
};
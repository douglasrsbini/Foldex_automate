import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Sidebar } from './components/Sidebar';
import { RuleBuilder } from './components/RuleBuilder';
import { FileExplorer } from './components/FileExplorer';
import { SimulationView } from './components/SimulationView';
import { HistoryView } from './components/HistoryView';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { SupportView } from './components/SupportView';
import { OnboardingTour } from './components/OnboardingTour';
import { SplashScreen } from './components/SplashScreen';
import { WelcomeSetup } from './components/WelcomeSetup';
import { LicenseInfo } from './types';
import './i18n';
import { 
  ShieldCheck, Globe, Lock, AlertCircle, Copy, Check, 
  Mail, ShoppingBag, RefreshCw, LogOut, ExternalLink,
  Award, KeyRound, ArrowRight, RotateCcw, ShieldAlert,
  Sliders, Cpu, Bot, X, Sparkles, Send, Loader2, User, BarChart3
} from 'lucide-react';

import appIcon from './assets/app-icon.png';

const ENABLE_AI_FEATURES = false; 

interface VerificationResponse {
  success: boolean;
  message: string;
  simulated_code?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
}

const getLicenseTag = (lic: LicenseInfo | null) => {
  if (!lic || !lic.is_activated || !lic.plan_name) return 'Community';
  const p = String(lic.plan_name).toLowerCase();
  
  if (p.includes('enterprise') || p.includes('master')) return 'Enterprise';
  if (p.includes('pro') || p.includes('professional')) return 'Pro';
  if (p.includes('basic') || p.includes('core')) return 'Basic';
  
  return 'Basic';
};

const renderFormattedText = (text: string) => {
  const paragraphs = text.split(/\n\s*\n/);

  return paragraphs.map((paragraph, pIdx) => {
    const lines = paragraph.split('\n');
    
    return (
      <p key={`p-${pIdx}`} className="mb-2 last:mb-0">
        {lines.map((line, lIdx) => {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          
          return (
            <React.Fragment key={`l-${lIdx}`}>
              {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <strong key={`s-${i}`} className="font-extrabold text-indigo-900 dark:text-indigo-200">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
                   return (
                     <span key={`c-${i}`} className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px] font-mono mx-0.5">
                       {part.slice(1, -1)}
                     </span>
                   );
                }
                return part;
              })}
              {lIdx < lines.length - 1 && <br />}
            </React.Fragment>
          );
        })}
      </p>
    );
  });
};

export const App: React.FC = () => {
  const [isLoadingApp, setIsLoadingApp] = useState(true);
  
  const [activeTab, setActiveTab] = useState('builder');
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  
  const [authStep, setAuthStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [inputEmail, setInputEmail] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [hintCode, setHintCode] = useState<string | null>(null);
  const [loadingActivation, setLoadingActivation] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const [isSetupDone, setIsSetupDone] = useState<boolean>(() => {
    return localStorage.getItem('foldex_setup_done') === 'true';
  });

  const [isTourOpen, setIsTourOpen] = useState<boolean>(() => {
    return localStorage.getItem('onboarding_tour_completed') !== 'true';
  });

  const [theme, setTheme] = useState<'Light' | 'Dark'>(() => {
    const savedTheme = localStorage.getItem('app_theme');
    return (savedTheme === 'Dark' || savedTheme === 'Light') ? savedTheme : 'Light';
  });

  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('accent_color') || '#0078d4';
  });

  const [userNiche, setUserNiche] = useState<string>(() => {
    return localStorage.getItem('foldex_user_niche') || '';
  });

  const [hourlyRate, setHourlyRate] = useState<number>(() => {
    const savedRate = localStorage.getItem('roi_hourly_rate');
    return savedRate ? parseFloat(savedRate) : 35.0;
  });

  const [selectedSourcePath, setSelectedSourcePath] = useState('');

  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
      id: 'welcome', 
      role: 'ai', 
      text: 'Olá! Eu sou o **Agente FOLDEX Automate**. Estou conectado ao motor cognitivo e pronto para te ajudar com regras ou dicas sobre o sistema. Como posso te auxiliar hoje?' 
    }
  ]);

  const isEnterprisePlan = license?.is_activated && license?.plan_name ? 
    (String(license.plan_name).toLowerCase().includes('enterprise') || String(license.plan_name).toLowerCase().includes('master')) : false;

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading, isAgentOpen]);

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const apiKey = localStorage.getItem('foldex_gemini_key');
    if (!apiKey) {
      alert("Acesso Negado: A chave da Inteligência Artificial não foi encontrada. Por favor, acesse a aba 'Configurações' e cadastre a sua chave Gemini.");
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    
    const newMessages = [...chatMessages, { id: Date.now().toString(), role: 'user' as const, text: userMessage }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    const historyToRust = newMessages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.text }));

    try {
      const response = await invoke<string>('chat_with_foldex_agent', { 
        messages: historyToRust, 
        apiKey: apiKey.trim() 
      });
      
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: response }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'ai', 
        text: `Desculpe, encontrei um erro de comunicação: ${error}` 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔍 [App Init]', {
      isLoadingApp,
      isSetupDone,
      showAppUI,
      theme,
      accentColor,
      localStorage: {
        foldex_setup_done: localStorage.getItem('foldex_setup_done'),
        app_theme: localStorage.getItem('app_theme'),
        accent_color: localStorage.getItem('accent_color'),
      }
    });
    loadLicense();
  }, []);

  const loadLicense = async () => {
    try {
      const res = await invoke<LicenseInfo>('get_license_status');
      setLicense(res);
      console.log('✅ [License Loaded]', res);
    } catch (e) {
      console.error('❌ [License Error]', e);
    }
  };

  useEffect(() => {
    const updateWindowTitle = async () => {
      try {
        const tag = getLicenseTag(license);
        await getCurrentWindow().setTitle(`Foldex Automate ${tag} — by BINAVER`);
      } catch (e) {
        console.error('Falha ao atualizar o título da janela', e);
      }
    };
    updateWindowTitle();
  }, [license]);

  const handleRequestCode = async () => {
    if (!inputEmail.trim()) {
      alert('Por favor, informe seu e-mail de compra.');
      return;
    }
    setLoadingActivation(true);
    try {
      const res = await invoke<VerificationResponse>('request_login_code', { email: inputEmail });
      setAuthStep('OTP');
      if (res.simulated_code) {
        setHintCode(res.simulated_code);
      }
    } catch (e) {
      alert(`Falha ao solicitar código: ${e}`);
    } finally {
      setLoadingActivation(false);
    }
  };

  const handleVerifyCode = async () => {
    if (inputCode.trim().length !== 6) {
      alert('O código de verificação deve conter 6 dígitos.');
      return;
    }
    setLoadingActivation(true);
    try {
      const res = await invoke<LicenseInfo>('verify_login_code', { email: inputEmail, code: inputCode });
      setLicense(res);
      setInputEmail('');
      setInputCode('');
      setHintCode(null);
      setAuthStep('EMAIL');
      alert('Licença confirmada e ativada com sucesso.');
    } catch (e) {
      alert(`Falha na validação: ${e}`);
    } finally {
      setLoadingActivation(false);
    }
  };

  const handleStoreActivation = async () => {
    setLoadingActivation(true);
    try {
      const res = await invoke<LicenseInfo>('activate_store_license');
      setLicense(res);
      alert('Compra da Microsoft Store vinculada com sucesso.');
    } catch (e) {
      alert(`Falha ao vincular com a Microsoft Store: ${e}`);
    } finally {
      setLoadingActivation(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Deseja desconectar a licença deste computador? O aplicativo retornará ao modo Demonstração.')) {
      try {
        await invoke('logout_license');
        loadLicense();
      } catch (e) {
        alert(e);
      }
    }
  };

  const handleCopyMachineId = () => {
    if (!license) return;
    navigator.clipboard.writeText(license.machine_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 3000);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'Dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const handleUpdateAccentColor = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('accent_color', color);
  };

  const handleUpdateHourlyRate = (rate: number) => {
    setHourlyRate(rate);
    localStorage.setItem('roi_hourly_rate', rate.toString());
  };

  const handleSetSourceFromExplorer = (path: string) => {
    setSelectedSourcePath(path);
    setActiveTab('builder');
  };

  const handleCompleteSetup = async (prefs: { niche: string | null; theme: 'Light' | 'Dark'; accentColor: string; reloadLicense?: boolean }) => {
    setTheme(prefs.theme);
    setAccentColor(prefs.accentColor);
    
    if (prefs.niche) {
      setUserNiche(prefs.niche);
      localStorage.setItem('foldex_user_niche', prefs.niche);
    }
    
    localStorage.setItem('app_theme', prefs.theme);
    localStorage.setItem('accent_color', prefs.accentColor);
    localStorage.setItem('foldex_setup_done', 'true');
    setIsSetupDone(true);
    
    if (prefs.reloadLicense) {
      await loadLicense();
    }
  };

  const showAppUI = !isLoadingApp && isSetupDone;

  return (
    <div className="flex h-screen w-screen text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none relative bg-slate-50 dark:bg-[#0B0F14]">
      
      {/* 🔍 DEBUG BADGE */}
      <div className="fixed bottom-2 right-2 z-50 text-[10px] font-mono bg-black/80 text-green-300 px-2 py-1 rounded pointer-events-none">
        isLoading:{isLoadingApp ? '1' : '0'} setup:{isSetupDone ? '1' : '0'} showUI:{showAppUI ? '1' : '0'}
      </div>
      
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 12s infinite alternate ease-in-out; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>

      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/40 dark:bg-blue-600/15 mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-emerald-300/30 dark:bg-emerald-600/10 mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-80 animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-purple-300/30 dark:bg-cyan-600/10 mix-blend-multiply dark:mix-blend-screen filter blur-[140px] opacity-80 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 flex h-full w-full">
        
        {!isLoadingApp && !isSetupDone && (
          <WelcomeSetup onComplete={handleCompleteSetup} />
        )}

        {isLoadingApp && (
          <SplashScreen accentColor={accentColor} onFinish={() => setIsLoadingApp(false)} />
        )}

        <div className={`flex h-full w-full transition-opacity duration-300 ${showAppUI ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-[-1] pointer-events-none'}`}>
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} accentColor={accentColor} license={license} />

          <main className="flex-1 p-4 overflow-hidden relative">
            {activeTab === 'builder' && (
              <RuleBuilder initialSource={selectedSourcePath || ''} accentColor={accentColor} onNavigateToAccount={() => setActiveTab('account')} userNiche={userNiche} />
            )}

            {activeTab === 'explorer' && (
              <FileExplorer onSetSource={handleSetSourceFromExplorer} accentColor={accentColor} />
            )}

            {activeTab === 'dryrun' && (
              <SimulationView accentColor={accentColor} />
            )}

            {activeTab === 'history' && (
              <HistoryView />
            )}

            {activeTab === 'dashboards' && (
              isEnterprisePlan ? (
                <DashboardView hourlyRate={hourlyRate} accentColor={accentColor} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 bg-white/70 dark:bg-[#1e1e24]/70 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-[#2e2e34] shadow-sm animate-in fade-in zoom-in-95">
                  <div className="w-20 h-20 bg-blue-50 dark:bg-[#25252b] rounded-full flex items-center justify-center mb-6"><BarChart3 size={40} className="text-blue-500" /></div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-2">Relatórios Analíticos e Retorno de Investimento</h2>
                  <p className="text-sm text-slate-500 text-center max-w-lg mb-8 leading-relaxed">Descubra exatamente o quanto o Foldex Automate está economizando de tempo e dinheiro na sua empresa. O Dashboard de Métricas é um recurso exclusivo do <strong className="text-blue-500">Foldex Automate Enterprise</strong>.</p>
                  <button onClick={() => setActiveTab('account')} className="px-8 py-3 rounded-2xl text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 bg-blue-600 hover:bg-blue-700"><Lock size={16} /> Ativar Licença Corporativa</button>
                </div>
              )
            )}

            {activeTab === 'settings' && (
              <SettingsView theme={theme} setTheme={(t) => setTheme(t as 'Light' | 'Dark')} accentColor={accentColor} setAccentColor={handleUpdateAccentColor} hourlyRate={hourlyRate} setHourlyRate={handleUpdateHourlyRate} />
            )}

            {activeTab === 'support' && (
              <SupportView accentColor={accentColor} onOpenTour={() => setIsTourOpen(true)} />
            )}

            {activeTab === 'account' && (
              <div className="p-6 bg-white/80 dark:bg-[#1e1e24]/80 backdrop-blur-2xl rounded-3xl border border-slate-200/50 dark:border-[#2e2e34]/50 max-w-3xl space-y-6 shadow-sm overflow-y-auto max-h-full mx-auto">
                
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2e2e34] pb-4">
                  <div className="flex items-center">
                    <img src={appIcon} alt="Foldex Automate Logo" className="w-6 h-6 object-contain mr-2 drop-shadow-sm" />
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white mr-1.5 tracking-tight">FOLDEX AUTOMATE</span>
                    <span className="text-xs text-slate-400 font-semibold lowercase mr-2 mt-1">by</span>
                    <img src="/logotipo-black.png" alt="BINAVER" className="h-6 sm:h-7 object-contain mt-1 dark:hidden" />
                    <img src="/logotipo-white.png" alt="BINAVER" className="h-6 sm:h-7 object-contain mt-1 hidden dark:block" />
                  </div>

                  <div className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border shadow-xs ${
                    license?.is_activated
                      ? 'bg-green-50/80 dark:bg-green-950/40 text-green-600 border-green-200/50 dark:border-green-800'
                      : 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-600 border-amber-200/50 dark:border-amber-800'
                  }`}>
                    {license?.is_activated ? <ShieldCheck size={15} /> : <AlertCircle size={15} />}
                    <span>{license?.is_activated ? 'Licença Ativa' : 'Modo Demonstração (Trial)'}</span>
                  </div>
                </div>

                {license?.is_activated ? (
                  <div className="p-5 bg-slate-50/50 dark:bg-[#18181b]/50 rounded-2xl border border-slate-200/50 dark:border-[#2e2e34]/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assinatura Vinculada</span>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <Award size={16} className="text-amber-500" />
                          {license.plan_name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {license.user_email ? `Conta: ${license.user_email}` : `Chave: ${license.license_key}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={loadLicense}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#27272a] hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#383840] flex items-center gap-1.5 transition-colors"
                          title="Atualizar status com a nuvem"
                        >
                          <RefreshCw size={13} /> Sincronizar
                        </button>
                        <button
                          onClick={handleLogout}
                          className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 hover:bg-red-100 text-xs font-bold border border-red-200 dark:border-red-900 flex items-center gap-1.5 transition-colors"
                          title="Desconectar deste dispositivo"
                        >
                          <LogOut size={13} /> Desconectar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/50 dark:border-[#2d2d34]/50 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Dispositivo Atual</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{license.machine_id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Canal de Licenciamento</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">
                          {license.source_channel === 'MICROSOFT_STORE' ? 'Microsoft Store (Windows)' : 'Binaver Cloud SaaS'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-5 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl border border-blue-200/50 dark:border-blue-900/50 space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-xs">
                        <Mail size={16} />
                        <span>Autenticação Segura por E-mail Corporativo</span>
                      </div>

                      {authStep === 'EMAIL' ? (
                        <>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            Informe o e-mail cadastrado na compra. Enviaremos um código de verificação temporário de 6 dígitos para confirmar a titularidade da sua licença.
                          </p>

                          <div className="flex gap-2">
                            <input
                              type="email"
                              placeholder="Digite seu e-mail corporativo"
                              value={inputEmail}
                              onChange={(e) => setInputEmail(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRequestCode()}
                              disabled={loadingActivation}
                              className="flex-1 px-3.5 py-2.5 text-xs bg-white/70 dark:bg-[#18181b]/70 border border-blue-200 dark:border-blue-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleRequestCode}
                              disabled={loadingActivation}
                              className="px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                              style={{ backgroundColor: accentColor }}
                            >
                              <span>{loadingActivation ? 'Enviando...' : 'Enviar Código'}</span>
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-slate-600 dark:text-slate-300">
                              Código enviado para <strong>{inputEmail}</strong>. Insira os 6 dígitos abaixo:
                            </p>
                            <button 
                              onClick={() => { setAuthStep('EMAIL'); setInputCode(''); }} 
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <RotateCcw size={11} /> Trocar e-mail
                            </button>
                          </div>

                          {hintCode && (
                            <div className="p-2 bg-blue-100/70 dark:bg-blue-900/40 rounded-lg text-[11px] text-blue-800 dark:text-blue-200 flex items-center justify-between font-mono">
                              <span>Código gerado para teste local: <strong>{hintCode}</strong></span>
                              <button 
                                onClick={() => setInputCode(hintCode)} 
                                className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-sans font-bold"
                              >
                                Preencher
                              </button>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <KeyRound size={15} className="absolute left-3 top-3 text-slate-400" />
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="000000"
                                value={inputCode}
                                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                                onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                                disabled={loadingActivation}
                                autoFocus
                                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white dark:bg-[#18181b] border border-blue-200 dark:border-blue-800 rounded-xl text-slate-800 dark:text-white font-mono tracking-widest font-bold outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <button
                              onClick={handleVerifyCode}
                              disabled={loadingActivation}
                              className="px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0"
                              style={{ backgroundColor: accentColor }}
                            >
                              {loadingActivation ? 'Validando...' : 'Confirmar e Ativar'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-4 bg-slate-50/50 dark:bg-[#18181b]/50 rounded-2xl border border-slate-200/50 dark:border-[#2e2e34]/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-200/70 dark:bg-[#27272a] text-slate-700 dark:text-slate-200">
                          <ShoppingBag size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white">Adquiriu via Microsoft Store?</h4>
                          <p className="text-[10px] text-slate-400">Sincronize sua licença com a conta Microsoft conectada</p>
                        </div>
                      </div>

                      <button
                        onClick={handleStoreActivation}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-[#27272a] hover:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#383840] transition-colors"
                      >
                        Sincronizar Licença
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-slate-50/50 dark:bg-[#18181b]/50 rounded-2xl border border-slate-200/50 dark:border-[#2e2e34]/50 text-xs space-y-2 text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white">
                      <Lock size={14} style={{ color: accentColor }} />
                      <span>Termos de Uso & Propriedade Intelectual</span>
                    </div>
                    <button
                      onClick={handleCopyMachineId}
                      className="text-[11px] text-blue-500 hover:underline flex items-center gap-1 font-mono"
                    >
                      <Cpu size={12} />
                      <span>ID: {license?.machine_id}</span>
                      {copiedId ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed flex items-center flex-wrap">
                    © 2026 
                    <strong className="flex items-center mx-1">
                      <img src="/logotipo-black.png" alt="BINAVER" className="h-4 w-auto object-contain dark:hidden" />
                      <img src="/logotipo-white.png" alt="BINAVER" className="h-4 w-auto object-contain hidden dark:block" /> 
                      <span className="ml-1">Soluções Tecnológicas - Ltda</span>
                    </strong>. Todos os direitos reservados. O software e seus módulos de governança de arquivos, auditoria e compressão são protegidos por leis de propriedade intelectual.
                  </p>
                </div>

                {license?.source_channel === 'MASTER_ACCOUNT' && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-900 space-y-3 mt-4 animate-in fade-in">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold text-xs">
                      <ShieldAlert size={16} />
                      <span>Ambiente de Homologação (Acesso Exclusivo BINAVER)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Transite entre os níveis de licenciamento para demonstração do produto ao cliente. Sua conta master não sofrerá downgrade definitivo.
                    </p>
                    <div className="flex items-center gap-2">
                      <Sliders size={14} className="text-purple-500" />
                      <select
                        className="flex-1 px-3 py-2 text-xs bg-white dark:bg-[#18181b] border border-purple-200 dark:border-purple-800 rounded-xl text-slate-800 dark:text-white font-medium outline-none cursor-pointer"
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          try {
                            await invoke('admin_change_plan', { newPlan: e.target.value });
                            await loadLicense();
                          } catch (err) {
                            alert(err);
                          }
                          e.target.value = '';
                        }}
                      >
                        <option value="">Selecione a licença para simular...</option>
                        <option value="Foldex Automate Basic">Simular: Foldex Automate Basic (Plano Básico)</option>
                        <option value="Foldex Automate Pro">Simular: Foldex Automate Pro (Plano Profissional)</option>
                        <option value="Foldex Automate Enterprise">Simular: Foldex Automate Enterprise (Plano Corporativo)</option>
                        <option value="Binaver Enterprise Master Full">Restaurar: Licença Master Original</option>
                      </select>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => window.open('https://binaver.com', '_blank')}
                  className="w-full py-3 rounded-2xl text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2" 
                  style={{ backgroundColor: accentColor }}
                >
                  <Globe size={15} /> Acessar Portal de Planos e Assinaturas (binaver.com)
                  <ExternalLink size={13} />
                </button>
              </div>
            )}

            <OnboardingTour
              accentColor={accentColor}
              isOpen={isTourOpen && isSetupDone}
              onClose={() => setIsTourOpen(false)}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          </main>

          {ENABLE_AI_FEATURES && (
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end shadow-2xl rounded-full">
              {isAgentOpen && (
                <div className="mb-4 w-[340px] sm:w-[400px] bg-white/90 dark:bg-[#1e1e24]/90 backdrop-blur-xl border border-slate-200 dark:border-[#383840] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300">
                  <div className="p-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between shadow-sm shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="bg-white/20 p-1.5 rounded-lg">
                        <Sparkles size={16} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider">Agente FOLDEX Automate</h3>
                        <p className="text-[10px] text-indigo-100 opacity-90">Governança Cognitiva</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsAgentOpen(false)} 
                      className="p-1 hover:bg-white/20 rounded-md transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div ref={chatContainerRef} className="h-72 sm:h-80 p-4 bg-slate-50/50 dark:bg-[#141416]/50 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-end gap-2 max-w-[85%]">
                          {msg.role === 'ai' && (
                            <div className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                              <Bot size={12} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                          )}
                          
                          <div className={`p-3 rounded-2xl text-[11.5px] leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white rounded-br-sm' 
                              : 'bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#2e2e34] text-slate-700 dark:text-slate-300 rounded-bl-sm'
                          }`}>
                            {msg.role === 'user' ? msg.text : renderFormattedText(msg.text)}
                          </div>

                          {msg.role === 'user' && (
                            <div className="w-6 h-6 shrink-0 rounded-full bg-slate-200 dark:bg-[#2e2e34] flex items-center justify-center border border-slate-300 dark:border-[#383840]">
                              <User size={12} className="text-slate-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="flex items-end gap-2">
                          <div className="w-6 h-6 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                            <Bot size={12} className="text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div className="p-3 bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#2e2e34] rounded-2xl rounded-bl-sm shadow-sm flex gap-1">
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-white/50 dark:bg-[#1e1e24]/50 border-t border-slate-100 dark:border-[#2e2e34] shrink-0">
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                        placeholder="Pergunte ao Agente FOLDEX Automate..." 
                        disabled={isChatLoading}
                        className="flex-1 px-3 py-2.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#383840] rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-white transition-colors disabled:opacity-60"
                      />
                      <button 
                        onClick={handleSendChatMessage}
                        disabled={isChatLoading || !chatInput.trim()}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl shadow-sm transition-transform active:scale-95 shrink-0"
                      >
                        {isChatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setIsAgentOpen(!isAgentOpen)}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border-2 z-50 ${
                  isAgentOpen 
                    ? 'bg-slate-800 border-slate-700 dark:bg-[#27272a] dark:border-[#383840] rotate-12' 
                    : 'bg-gradient-to-tr from-indigo-600 to-blue-500 border-indigo-400 hover:shadow-indigo-500/50'
                }`}
                title="Agente FOLDEX Automate (Inteligência Artificial)"
              >
                {isAgentOpen ? <X size={24} /> : <Bot size={24} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  Building2, Scale, Calculator, Users, Briefcase, 
  Sun, Moon, Check, ChevronRight, Wheat, Edit3, 
  ShieldCheck, FlaskConical, Mail, ArrowRight, RotateCcw, KeyRound, ShoppingBag
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
// ⚡ IMPORTAÇÃO BLINDADA PARA O BUILD
import appIcon from '../assets/app-icon.png';

interface WelcomeSetupProps {
  onComplete: (preferences: { niche: string | null; theme: 'Light' | 'Dark'; accentColor: string; reloadLicense?: boolean }) => void;
}

export const WelcomeSetup: React.FC<WelcomeSetupProps> = ({ onComplete }) => {
  const { t, i18n } = useTranslation();
  
  const [step, setStep] = useState(0); 
  const [niche, setNiche] = useState<string | null>(null);
  const [theme, setTheme] = useState<'Light' | 'Dark'>('Dark');
  const [accentColor, setAccentColor] = useState('#2F80ED'); 
  
  const [activationChoice, setActivationChoice] = useState<'trial' | 'activate'>('trial');
  
  const [authStep, setAuthStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [inputEmail, setInputEmail] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [hintCode, setHintCode] = useState<string | null>(null);
  const [loadingActivation, setLoadingActivation] = useState(false);

  const [greetingIdx, setGreetingIdx] = useState(0);
  const greetings = [
    { title: 'Bem-vindo ao Foldex Automate', sub: 'Escolha seu idioma preferido para começar.' }, 
    { title: 'Welcome to Foldex Automate', sub: 'Choose your preferred language to start.' }, 
    { title: 'Bienvenido a Foldex Automate', sub: 'Elige tu idioma preferido para empezar.' }, 
    { title: 'Bienvenue sur Foldex Automate', sub: 'Choisissez votre langue préférée pour commencer.' } 
  ];

  useEffect(() => {
    console.log('👋 [WelcomeSetup] Mounted');
    return () => console.log('👋 [WelcomeSetup] Unmounted');
  }, []);

  useEffect(() => {
    if (step !== 0) return;
    const interval = setInterval(() => {
      setGreetingIdx((prev) => (prev + 1) % greetings.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [step, greetings.length]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Varela+Round&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const languages = [
    { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
    { code: 'en', label: 'English (US)', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'pt-PT', label: 'Português (Portugal)', flag: '🇵🇹' },
  ];

  const niches = [
    { id: 'cartorio', label: t('setup.niche_cartorio', 'Cartório / Notas'), icon: Building2, desc: t('setup.niche_cartorio_desc', 'Organização de matrículas e registros.') },
    { id: 'contabilidade', label: t('setup.niche_contabilidade', 'Contabilidade / Financeiro'), icon: Calculator, desc: t('setup.niche_contabilidade_desc', 'Triagem de notas fiscais e comprovantes.') },
    { id: 'juridico', label: t('setup.niche_juridico', 'Escritório Jurídico'), icon: Scale, desc: t('setup.niche_juridico_desc', 'Organização de petições e processos.') },
    { id: 'rh', label: t('setup.niche_rh', 'Recursos Humanos'), icon: Users, desc: t('setup.niche_rh_desc', 'Dossiês e folhas de ponto.') },
    { id: 'agro', label: t('setup.niche_agro', 'Agro / Cooperativas'), icon: Wheat, desc: t('setup.niche_agro_desc', 'Romaneios, receituários e contratos.') },
    { id: 'geral', label: t('setup.niche_geral', 'Geral / Outros'), icon: Briefcase, desc: t('setup.niche_geral_desc', 'Organização livre e genérica.') },
  ];

  const presetColors = ['#2F80ED', '#27AE60', '#8b5cf6', '#f97316'];
  const isCustomColor = !presetColors.includes(accentColor);

  const handleSelectLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('foldex_language', langCode);
    setStep(1);
  };

  const handleRequestCode = async () => {
    if (!inputEmail.trim()) { alert('Por favor, informe seu e-mail de compra.'); return; }
    setLoadingActivation(true);
    try {
      const res: any = await invoke('request_login_code', { email: inputEmail });
      setAuthStep('OTP');
      if (res.simulated_code) setHintCode(res.simulated_code);
    } catch (e) { alert(`Falha ao solicitar código: ${e}`); } finally { setLoadingActivation(false); }
  };

  const handleVerifyCode = async () => {
    if (inputCode.trim().length !== 6) { alert('O código de verificação deve conter 6 dígitos.'); return; }
    setLoadingActivation(true);
    try {
      await invoke('verify_login_code', { email: inputEmail, code: inputCode });
      alert('Licença confirmada e ativada com sucesso!');
      onComplete({ niche, theme, accentColor, reloadLicense: true });
    } catch (e) { alert(`Falha na validação: ${e}`); } finally { setLoadingActivation(false); }
  };

  const handleStoreActivation = async () => {
    setLoadingActivation(true);
    try {
      await invoke('activate_store_license');
      alert('Compra da Microsoft Store vinculada com sucesso!');
      onComplete({ niche, theme, accentColor, reloadLicense: true });
    } catch (e) { alert(`Falha ao vincular: ${e}`); } finally { setLoadingActivation(false); }
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none overflow-hidden transition-colors duration-500 ${
        theme === 'Dark' ? 'bg-[#0B0F14]' : 'bg-[#f4f6f9]'
      }`}
    >
      <style>{`
        @keyframes binaverLiquid1 { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(100px, -80px) scale(1.25); } 66% { transform: translate(-70px, 90px) scale(0.9); } 100% { transform: translate(0px, 0px) scale(1); } }
        @keyframes binaverLiquid2 { 0% { transform: translate(0px, 0px) scale(1); } 33% { transform: translate(-90px, 80px) scale(1.35); } 66% { transform: translate(80px, -70px) scale(0.8); } 100% { transform: translate(0px, 0px) scale(1); } }
        .animate-binaver-1 { animation: binaverLiquid1 12s infinite alternate ease-in-out; }
        .animate-binaver-2 { animation: binaverLiquid2 16s infinite alternate ease-in-out; }
      `}</style>

      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full filter blur-[120px] animate-binaver-1 transition-opacity duration-500 ${theme === 'Dark' ? 'bg-[#2F80ED]/60' : 'bg-[#2F80ED]/25'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[55vw] h-[55vw] rounded-full filter blur-[120px] animate-binaver-2 transition-opacity duration-500 ${theme === 'Dark' ? 'bg-[#27AE60]/50' : 'bg-[#27AE60]/20'}`} />
        <div className={`absolute inset-0 backdrop-blur-[60px] transition-colors duration-500 ${theme === 'Dark' ? 'bg-[#0B0F14]/70' : 'bg-white/60'}`} />
      </div>

      <div className={`w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 transform border relative z-10 ${theme === 'Dark' ? 'bg-[#0B0F14]/85 border-white/20 text-white shadow-black/90' : 'bg-white/85 border-white/80 text-slate-900 shadow-slate-500/30'}`} style={{ fontFamily: "'Quicksand', sans-serif", backdropFilter: 'blur(30px) saturate(180%)' }}>
        
        <div className="p-8 pb-6 flex flex-col items-center justify-center text-center relative overflow-hidden h-40 w-full">
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: accentColor, transition: 'background-color 0.3s' }} />
          
          <div className="relative mb-3 flex items-center justify-center animate-in fade-in zoom-in-75 duration-500">
            <div className="absolute w-12 h-12 rounded-full filter blur-xl opacity-60 pointer-events-none" style={{ backgroundColor: accentColor }} />
            
            <img src={appIcon} alt="Foldex Automate Icon" className="w-10 h-10 relative z-10 drop-shadow-md object-contain" />
          </div>

          {step === 0 ? (
            <div className="relative w-full h-16 flex items-center justify-center">
              {greetings.map((greet, idx) => {
                const isActive = idx === greetingIdx;
                return (
                  <div key={idx} className={`absolute flex flex-col items-center w-full transition-all duration-1000 ease-in-out ${isActive ? 'opacity-100 translate-y-0 blur-none scale-100' : 'opacity-0 translate-y-3 blur-sm scale-95 pointer-events-none'}`}>
                    <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ fontFamily: "'Varela Round', sans-serif" }}>{greet.title}</h1>
                    <p className={`text-xs ${theme === 'Dark' ? 'text-slate-300 font-medium' : 'text-slate-600 font-medium'}`}>{greet.sub}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out flex flex-col items-center w-full">
              <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ fontFamily: "'Varela Round', sans-serif" }}>
                {step === 1 ? t('setup.title_1', 'Qual o seu nicho?') : 
                 step === 2 ? t('setup.title_2', 'Personalize seu Ambiente') :
                 step === 3 ? 'Modo de Uso' : 'Ativação do Sistema'}
              </h1>
              <p className={`text-xs ${theme === 'Dark' ? 'text-slate-300 font-medium' : 'text-slate-600 font-medium'}`}>
                {step === 1 ? t('setup.subtitle_1', 'Para entregarmos a melhor experiência, conte-nos um pouco sobre seu uso.') : 
                 step === 2 ? t('setup.subtitle_2', 'Deixe o Foldex Automate com a cara da sua empresa.') :
                 step === 3 ? 'Escolha como deseja continuar usando o Foldex Automate.' : 'Autentique sua licença corporativa.'}
              </p>
            </div>
          )}
        </div>

        {step === 0 && (
          <div className="px-8 pb-8 space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-700 max-h-[50vh] overflow-y-auto custom-scrollbar">
            {languages.map((l) => (
              <button key={l.code} onClick={() => handleSelectLanguage(l.code)} className={`w-full flex items-center p-4 rounded-2xl border transition-all duration-300 text-left group backdrop-blur-md ${theme === 'Dark' ? 'bg-[#151a23]/90 border-white/10 hover:bg-[#1d2431] hover:border-white/30 text-white' : 'bg-white/90 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-900'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-4 text-2xl bg-black/10 dark:bg-white/10 group-hover:scale-110 transition-transform duration-300 shadow-xs">{l.flag}</div>
                <div className="flex-1"><h3 className="text-base font-bold" style={{ fontFamily: "'Varela Round', sans-serif" }}>{l.label}</h3></div>
                <ChevronRight size={18} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="px-8 pb-8 space-y-2.5 animate-in fade-in slide-in-from-right-8 duration-500 max-h-[50vh] overflow-y-auto custom-scrollbar">
            {niches.map((n) => {
              const Icon = n.icon;
              const isSelected = niche === n.id;
              return (
                <button key={n.id} onClick={() => setNiche(n.id)} className={`w-full flex items-center p-3.5 rounded-2xl border transition-all duration-200 text-left backdrop-blur-md ${isSelected ? 'border-transparent shadow-md' : theme === 'Dark' ? 'bg-[#151a23]/90 border-white/10 hover:bg-[#1d2431] text-white' : 'bg-white/90 border-slate-200 hover:bg-white text-slate-900'}`} style={isSelected ? { backgroundColor: `${accentColor}40`, borderColor: accentColor } : {}}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-4 transition-colors" style={{ backgroundColor: isSelected ? accentColor : (theme === 'Dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'), color: isSelected ? '#fff' : (theme === 'Dark' ? '#cbd5e1' : '#475569') }}><Icon size={20} /></div>
                  <div className="flex-1"><h3 className="text-sm font-bold mb-0.5" style={{ fontFamily: "'Varela Round', sans-serif" }}>{n.label}</h3><p className={`text-[11px] ${theme === 'Dark' ? 'text-slate-300' : 'text-slate-600'}`}>{n.desc}</p></div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-transparent' : (theme === 'Dark' ? 'border-white/20' : 'border-black/20')}`} style={isSelected ? { backgroundColor: accentColor } : {}}>{isSelected && <Check size={12} className="text-white" />}</div>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="px-8 pb-8 space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'Dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('setup.theme_title')}</span>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setTheme('Light')} className={`py-4 rounded-2xl font-bold border flex flex-col items-center justify-center gap-2 transition-all ${theme === 'Light' ? 'shadow-md border-blue-500 text-blue-600 bg-blue-500/10' : theme === 'Dark' ? 'bg-[#151a23]/90 border-white/10 text-slate-400 hover:bg-[#1d2431]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'}`} style={theme === 'Light' ? { backgroundColor: `${accentColor}20`, borderColor: accentColor, color: accentColor } : {}}><Sun size={24} /><span style={{ fontFamily: "'Varela Round', sans-serif" }}>{t('setup.theme_light')}</span></button>
                <button onClick={() => setTheme('Dark')} className={`py-4 rounded-2xl font-bold border flex flex-col items-center justify-center gap-2 transition-all ${theme === 'Dark' ? 'shadow-md border-blue-500 text-blue-400 bg-blue-500/10' : theme === 'Light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs' : 'bg-[#151a23]/90 border-white/10 text-slate-400 hover:bg-[#1d2431]'}`} style={theme === 'Dark' ? { backgroundColor: `${accentColor}30`, borderColor: accentColor, color: accentColor } : {}}><Moon size={24} /><span style={{ fontFamily: "'Varela Round', sans-serif" }}>{t('setup.theme_dark')}</span></button>
              </div>
            </div>

            <div className="space-y-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'Dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t('setup.color_title')}</span>
              <div className="flex flex-wrap items-center gap-3">
                {presetColors.map(c => (
                  <button key={c} onClick={() => setAccentColor(c)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${accentColor === c ? 'scale-110' : 'hover:scale-105'}`} style={{ backgroundColor: c, boxShadow: accentColor === c ? `0 0 0 2px ${theme === 'Dark' ? '#0B0F14' : '#fff'}, 0 0 0 5px ${c}` : 'none' }} title={c}>{accentColor === c && <Check size={18} className="text-white drop-shadow-md" />}</button>
                ))}
                <div className="relative">
                  <input type="color" value={isCustomColor ? accentColor : '#ffffff'} onChange={(e) => setAccentColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-2xl z-10" title="Escolher cor personalizada" />
                  <div className={`px-4 h-10 rounded-2xl flex items-center gap-2 border-2 transition-all cursor-pointer shadow-sm ${isCustomColor ? 'scale-105 border-transparent' : theme === 'Dark' ? 'border-dashed border-white/30 hover:border-white text-slate-300 bg-[#151a23]' : 'border-dashed border-slate-400 hover:border-slate-600 text-slate-700 bg-white'}`} style={isCustomColor ? { backgroundColor: accentColor, color: '#fff', boxShadow: `0 0 0 2px ${theme === 'Dark' ? '#0B0F14' : '#fff'}, 0 0 0 5px ${accentColor}` } : {}}><Edit3 size={15} /><span className="text-xs font-bold" style={{ fontFamily: "'Varela Round', sans-serif" }}>Cor personalizada</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="px-8 pb-8 space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'Dark' ? 'text-slate-400' : 'text-slate-500'}`}>Modo de Uso</span>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => setActivationChoice('trial')} className={`p-4 rounded-2xl border text-left transition-all flex gap-4 items-center ${activationChoice === 'trial' ? 'shadow-md border-slate-400 bg-slate-500/10' : theme === 'Dark' ? 'bg-[#151a23]/90 border-white/10 hover:bg-[#1d2431]' : 'bg-white border-slate-200 hover:bg-slate-50'}`} style={activationChoice === 'trial' ? { borderColor: accentColor, backgroundColor: `${accentColor}15` } : {}}>
                  <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-slate-500/20" style={{ color: activationChoice === 'trial' ? accentColor : '' }}><FlaskConical size={20} /></div>
                  <div className="flex-1"><h4 className={`text-sm font-bold ${theme === 'Dark' ? 'text-white' : 'text-slate-900'}`}>Testar Gratuitamente</h4><p className={`text-[11px] ${theme === 'Dark' ? 'text-slate-400' : 'text-slate-500'}`}>Modo Demonstração (Trial) com acesso ao motor local.</p></div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${activationChoice === 'trial' ? 'border-transparent' : (theme === 'Dark' ? 'border-white/20' : 'border-black/20')}`} style={activationChoice === 'trial' ? { backgroundColor: accentColor } : {}}>{activationChoice === 'trial' && <Check size={12} className="text-white" />}</div>
                </button>
                <button onClick={() => setActivationChoice('activate')} className={`p-4 rounded-2xl border text-left transition-all flex gap-4 items-center ${activationChoice === 'activate' ? 'shadow-md border-blue-500 bg-blue-500/10' : theme === 'Dark' ? 'bg-[#151a23]/90 border-white/10 hover:bg-[#1d2431]' : 'bg-white border-slate-200 hover:bg-slate-50'}`} style={activationChoice === 'activate' ? { borderColor: accentColor, backgroundColor: `${accentColor}15` } : {}}>
                  <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-blue-500/20" style={{ color: activationChoice === 'activate' ? accentColor : '' }}><ShieldCheck size={20} /></div>
                  <div className="flex-1"><h4 className={`text-sm font-bold ${theme === 'Dark' ? 'text-white' : 'text-slate-900'}`}>Já tenho uma Licença</h4><p className={`text-[11px] ${theme === 'Dark' ? 'text-slate-400' : 'text-slate-500'}`}>Ativar versão Pro / Enterprise com E-mail ou Chave.</p></div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${activationChoice === 'activate' ? 'border-transparent' : (theme === 'Dark' ? 'border-white/20' : 'border-black/20')}`} style={activationChoice === 'activate' ? { backgroundColor: accentColor } : {}}>{activationChoice === 'activate' && <Check size={12} className="text-white" />}</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="px-8 pb-8 space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="space-y-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'Dark' ? 'text-slate-400' : 'text-slate-500'}`}>Ativar Licença Corporativa</span>
              
              <div className={`p-5 rounded-2xl border transition-all ${theme === 'Dark' ? 'bg-[#151a23]/90 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                <div className={`flex items-center gap-2 font-bold text-sm mb-3 ${theme === 'Dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                  <Mail size={18} /><span>Autenticação por E-mail</span>
                </div>
                {authStep === 'EMAIL' ? (
                  <>
                    <p className={`text-xs mb-3 ${theme === 'Dark' ? 'text-slate-300' : 'text-slate-600'}`}>Informe o e-mail cadastrado na compra para receber o código.</p>
                    <div className="flex gap-2">
                      <input type="email" value={inputEmail} onChange={(e) => setInputEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRequestCode()} disabled={loadingActivation} placeholder="seu@email.com" className={`flex-1 px-4 py-2.5 rounded-xl text-sm outline-none border focus:ring-2 focus:ring-blue-500 transition-colors ${theme === 'Dark' ? 'bg-[#0B0F14] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                      <button onClick={handleRequestCode} disabled={loadingActivation} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-blue-600 hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2">
                        {loadingActivation ? 'Enviando...' : 'Enviar'} {!loadingActivation && <ArrowRight size={14} />}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className={`text-xs ${theme === 'Dark' ? 'text-slate-300' : 'text-slate-600'}`}>Código enviado para <strong>{inputEmail}</strong></p>
                      <button onClick={() => { setAuthStep('EMAIL'); setInputCode(''); }} className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"><RotateCcw size={11} /> Trocar</button>
                    </div>
                    {hintCode && (
                      <div className="mb-3 p-2 bg-blue-500/20 rounded-lg text-[11px] text-blue-300 flex items-center justify-between font-mono">
                        <span>Local Dev: <strong>{hintCode}</strong></span>
                        <button onClick={() => setInputCode(hintCode)} className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-sans font-bold">Usar</button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <KeyRound size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input type="text" maxLength={6} placeholder="000000" value={inputCode} onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()} disabled={loadingActivation} autoFocus className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none border focus:ring-2 focus:ring-blue-500 tracking-widest font-mono font-bold transition-colors ${theme === 'Dark' ? 'bg-[#0B0F14] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                      </div>
                      <button onClick={handleVerifyCode} disabled={loadingActivation} className="px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-blue-600 hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50">
                        {loadingActivation ? 'Validando...' : 'Ativar'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className={`p-4 flex items-center justify-between rounded-2xl border transition-all ${theme === 'Dark' ? 'bg-[#151a23]/90 border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${theme === 'Dark' ? 'bg-white/5' : 'bg-slate-100'}`}><ShoppingBag size={20} className={theme === 'Dark' ? 'text-slate-300' : 'text-slate-600'} /></div>
                  <div>
                    <h4 className={`text-sm font-bold ${theme === 'Dark' ? 'text-white' : 'text-slate-900'}`}>Microsoft Store</h4>
                    <p className={`text-[11px] ${theme === 'Dark' ? 'text-slate-500' : 'text-slate-400'}`}>Sincronizar com a conta Windows</p>
                  </div>
                </div>
                <button onClick={handleStoreActivation} disabled={loadingActivation} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${theme === 'Dark' ? 'bg-white/10 border-white/10 text-white hover:bg-white/20' : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'}`}>
                  Sincronizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé e Navegação */}
        {step > 0 && (
          <div className={`p-6 flex items-center justify-between border-t backdrop-blur-xl ${theme === 'Dark' ? 'bg-[#0f141a]/90 border-white/10 text-slate-300' : 'bg-slate-50/90 border-slate-100 text-slate-700'}`}>
            <div className="text-xs font-bold flex items-center gap-2">
              <img src={appIcon} alt="Foldex Automate Icon" className="w-4 h-4 shrink-0 object-contain" />
              <span>Foldex Automate v1.0.0</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep(step - 1)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${theme === 'Dark' ? 'text-slate-200 hover:bg-white/10' : 'text-slate-600 hover:bg-black/10'}`}
              >
                {t('setup.btn_back', 'Voltar')}
              </button>
              
              {step === 4 ? (
                <button
                  onClick={() => onComplete({ niche, theme, accentColor })}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${theme === 'Dark' ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-200'}`}
                >
                  <span>Pular Ativação</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (step === 3) {
                      if (activationChoice === 'activate') setStep(4);
                      else onComplete({ niche, theme, accentColor });
                    } else {
                      setStep(step + 1);
                    }
                  }}
                  disabled={step === 1 && !niche}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-bold flex items-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: accentColor }}
                >
                  <span>{step === 3 && activationChoice === 'trial' ? t('setup.btn_finish', 'Finalizar') : t('setup.btn_continue', 'Continuar')}</span>
                  {(step !== 3 || activationChoice === 'activate') && <ChevronRight size={16} />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
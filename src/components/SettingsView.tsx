import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  isPermissionGranted, 
  requestPermission, 
  sendNotification 
} from '@tauri-apps/plugin-notification';
import { 
  Settings2, Palette, Bell, Save, Check, 
  ShieldAlert, FolderArchive, RotateCcw, Bot, BellRing, Sun, Moon, 
  Cpu, Calculator, Lock, EyeOff, Eye, Sparkles, Server, Cloud
} from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ⚡ Óculos Mágicos ativados!

const ENABLE_AI_FEATURES = false; 

interface SettingsViewProps {
  theme: 'Light' | 'Dark';
  setTheme: (theme: string) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  hourlyRate: number;
  setHourlyRate: (rate: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  hourlyRate,
  setHourlyRate,
}) => {
  const { t } = useTranslation(); // ⚡ Instância do tradutor
  
  const [masterNotif, setMasterNotif] = useState<boolean>(() => localStorage.getItem('notif_master_enabled') !== 'false');
  const [notifAutoExec, setNotifAutoExec] = useState<boolean>(() => localStorage.getItem('notif_auto_execution') !== 'false');
  const [notifBackupZip, setNotifBackupZip] = useState<boolean>(() => localStorage.getItem('notif_backup_zip') !== 'false');
  const [notifRollback, setNotifRollback] = useState<boolean>(() => localStorage.getItem('notif_rollback') !== 'false');
  const [notifIntegrity, setNotifIntegrity] = useState<boolean>(() => localStorage.getItem('notif_integrity_alerts') !== 'false');

  const [autopilotMode, setAutopilotMode] = useState<string>(() => localStorage.getItem('autopilot_mode') || 'REALTIME');
  const [inputRate, setInputRate] = useState<string>(hourlyRate.toString());
  
  const [zipPassword, setZipPassword] = useState<string>(() => localStorage.getItem('backup_zip_password') || '');
  const [showZipPassword, setShowZipPassword] = useState(false);

  const [aiModel, setAiModel] = useState<string>(() => localStorage.getItem('foldex_ai_model') || 'GEMINI');
  const [geminiKey, setGeminiKey] = useState<string>(() => localStorage.getItem('foldex_gemini_key') || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // ⚡ Tradução Dinâmica do Vetor de Cores
  const presetColors = [
    { name: t('settings.preset_colors.blue'), value: '#0078d4' },
    { name: t('settings.preset_colors.green'), value: '#10b981' },
    { name: t('settings.preset_colors.purple'), value: '#8b5cf6' },
    { name: t('settings.preset_colors.orange'), value: '#f97316' },
    { name: t('settings.preset_colors.cyan'), value: '#06b6d4' },
  ];

  const handleSaveSettings = async () => {
    const rate = parseFloat(inputRate) || 35.0;
    setHourlyRate(rate);

    localStorage.setItem('notif_master_enabled', masterNotif.toString());
    localStorage.setItem('notif_auto_execution', notifAutoExec.toString());
    localStorage.setItem('notif_backup_zip', notifBackupZip.toString());
    localStorage.setItem('notif_rollback', notifRollback.toString());
    localStorage.setItem('notif_integrity_alerts', notifIntegrity.toString());
    localStorage.setItem('autopilot_mode', autopilotMode);
    localStorage.setItem('backup_zip_password', zipPassword);
    
    localStorage.setItem('foldex_ai_model', aiModel);
    localStorage.setItem('foldex_gemini_key', geminiKey);

    try {
      await Promise.all([
        invoke('save_setting', { key: 'notif_master_enabled', value: masterNotif.toString() }),
        invoke('save_setting', { key: 'notif_auto_execution', value: notifAutoExec.toString() }),
        invoke('save_setting', { key: 'notif_backup_zip', value: notifBackupZip.toString() }),
        invoke('save_setting', { key: 'notif_rollback', value: notifRollback.toString() }),
        invoke('save_setting', { key: 'notif_integrity_alerts', value: notifIntegrity.toString() }),
        invoke('save_setting', { key: 'autopilot_mode', value: autopilotMode }),
        invoke('save_setting', { key: 'backup_zip_password', value: zipPassword }),
      ]);
    } catch (e) {
      console.error('Falha ao persistir no SQLite:', e);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestNotification = async () => {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }

      if (permissionGranted) {
        sendNotification({
          title: 'Foldex by BINAVER',
          body: t('settings.notif_msgs.test_success'),
        });
      } else {
        await invoke('show_system_notification', {
          notifType: 'GENERAL',
          title: 'Foldex by BINAVER',
          body: t('settings.notif_msgs.test_native'),
        });
      }
    } catch (e) {
      try {
        await invoke('show_system_notification', {
          notifType: 'GENERAL',
          title: 'Foldex by BINAVER',
          body: t('settings.notif_msgs.test_native'),
        });
      } catch (err) {
        alert(`${t('settings.notif_msgs.test_error')} ${err}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1 select-none w-full custom-scrollbar">
      
      {/* Cabeçalho */}
      <div className="p-4 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Settings2 size={18} style={{ color: accentColor }} />
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {t('settings.title')}
            </h2>
            <p className="text-[11px] text-slate-400">{t('settings.subtitle')}</p>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          {savedSuccess ? <Check size={14} /> : <Save size={14} />}
          <span>{savedSuccess ? t('settings.btn_saved') : t('settings.btn_save')}</span>
        </button>
      </div>

      {/* Grid com Painéis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
        
        {/* 🤖 PAINEL DE INTELIGÊNCIA ARTIFICIAL */}
        {ENABLE_AI_FEATURES && (
          <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm space-y-4 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#2e2e34] pb-3">
              <Sparkles size={16} className="text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                {t('settings.ai.title')}
              </h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('settings.ai.engine_label')}</span>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setAiModel('GEMINI')} 
                    className={`p-2.5 rounded-xl border flex flex-col gap-1 items-start transition-colors ${aiModel === 'GEMINI' ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 dark:bg-[#18181b] dark:border-[#2e2e34] opacity-70'}`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                      <Cloud size={14} className={aiModel === 'GEMINI' ? 'text-indigo-500' : 'text-slate-400'} />
                      {t('settings.ai.gemini_title')}
                    </div>
                    <span className="text-[9px] text-slate-500 text-left">{t('settings.ai.gemini_desc')}</span>
                  </button>
                  
                  <button 
                    onClick={() => alert(t('settings.ai.local_alert'))} 
                    className={`p-2.5 rounded-xl border flex flex-col gap-1 items-start transition-colors ${aiModel === 'LOCAL' ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-800' : 'bg-slate-50 border-slate-200 dark:bg-[#18181b] dark:border-[#2e2e34] opacity-50 cursor-not-allowed'}`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                      <Server size={14} className="text-slate-400" />
                      {t('settings.ai.local_title')}
                    </div>
                    <span className="text-[9px] text-slate-500 text-left">{t('settings.ai.local_desc')}</span>
                  </button>
                </div>
              </div>

              {aiModel === 'GEMINI' && (
                <div className="pt-2 animate-in fade-in">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">{t('settings.ai.key_label')}</label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? "text" : "password"}
                      placeholder={t('settings.ai.key_ph')}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white font-mono font-medium outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🔔 Painel 1: Central de Notificações */}
        <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2e2e34] pb-3">
            <div className="flex items-center gap-2">
              <Bell size={16} style={{ color: accentColor }} />
              <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                {t('settings.notif.title')}
              </h3>
            </div>
            <button
              onClick={handleTestNotification}
              disabled={!masterNotif}
              className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 disabled:opacity-40 text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 border border-slate-200 dark:border-[#383840] transition-colors"
            >
              <BellRing size={12} /> {t('settings.notif.test_btn')}
            </button>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e34] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-white block">
                {t('settings.notif.global_title')}
              </span>
              <span className="text-[11px] text-slate-400">{t('settings.notif.global_desc')}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={masterNotif} onChange={(e) => setMasterNotif(e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-[#333338] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className={`space-y-2 text-xs transition-opacity ${masterNotif ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('settings.notif.events_label')}</span>
            <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#18181b] cursor-pointer">
              <div className="flex items-center gap-2"><Bot size={14} className="text-green-600" /><span className="text-slate-700 dark:text-slate-300 font-medium">{t('settings.notif.event_auto')}</span></div>
              <input type="checkbox" checked={notifAutoExec} onChange={(e) => setNotifAutoExec(e.target.checked)} className="rounded text-blue-600 h-4 w-4" />
            </label>
            <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#18181b] cursor-pointer">
              <div className="flex items-center gap-2"><FolderArchive size={14} className="text-blue-500" /><span className="text-slate-700 dark:text-slate-300 font-medium">{t('settings.notif.event_backup')}</span></div>
              <input type="checkbox" checked={notifBackupZip} onChange={(e) => setNotifBackupZip(e.target.checked)} className="rounded text-blue-600 h-4 w-4" />
            </label>
            <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#18181b] cursor-pointer">
              <div className="flex items-center gap-2"><RotateCcw size={14} className="text-red-500" /><span className="text-slate-700 dark:text-slate-300 font-medium">{t('settings.notif.event_rollback')}</span></div>
              <input type="checkbox" checked={notifRollback} onChange={(e) => setNotifRollback(e.target.checked)} className="rounded text-blue-600 h-4 w-4" />
            </label>
            <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#18181b] cursor-pointer">
              <div className="flex items-center gap-2"><ShieldAlert size={14} className="text-purple-500" /><span className="text-slate-700 dark:text-slate-300 font-medium">{t('settings.notif.event_integrity')}</span></div>
              <input type="checkbox" checked={notifIntegrity} onChange={(e) => setNotifIntegrity(e.target.checked)} className="rounded text-blue-600 h-4 w-4" />
            </label>
          </div>
        </div>

        {/* 🎨 Painel 2: Tema & Identidade Visual */}
        <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#2e2e34] pb-3">
            <Palette size={16} style={{ color: accentColor }} />
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {t('settings.theme.title')}
            </h3>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('settings.theme.visual_label')}</span>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTheme('Light')} className={`py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-colors ${theme === 'Light' ? 'bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/40' : 'bg-slate-50 dark:bg-[#18181b] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2e2e34]'}`}><Sun size={14} /><span>{t('settings.theme.light')}</span></button>
              <button onClick={() => setTheme('Dark')} className={`py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-colors ${theme === 'Dark' ? 'bg-blue-950/60 text-blue-400 border-blue-800' : 'bg-slate-50 dark:bg-[#18181b] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#2e2e34]'}`}><Moon size={14} /><span>{t('settings.theme.dark')}</span></button>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('settings.theme.color_label')}</span>
            <div className="flex flex-wrap items-center gap-2">
              {presetColors.map(c => (
                <button key={c.value} onClick={() => setAccentColor(c.value)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${accentColor === c.value ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-105'}`} style={{ backgroundColor: c.value }} title={c.name}>
                  {accentColor === c.value && <Check size={13} className="text-white" />}
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200 dark:border-[#2e2e34]">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0" title={t('settings.theme.color_custom')} />
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">{accentColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ⚙️ Painel 3: Motor de Automação & Segurança (CRIPTO) */}
        <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#2e2e34] pb-3">
            <Cpu size={16} style={{ color: accentColor }} />
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {t('settings.engine.title')}
            </h3>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('settings.engine.freq_label')}</span>
            <select value={autopilotMode} onChange={(e) => setAutopilotMode(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white font-bold outline-none cursor-pointer dark:[color-scheme:dark]">
              <option value="REALTIME" className="bg-white dark:bg-[#202024]">{t('settings.engine.freq_realtime')}</option>
              <option value="INTERVAL_1M" className="bg-white dark:bg-[#202024]">{t('settings.engine.freq_1m')}</option>
              <option value="INTERVAL_5M" className="bg-white dark:bg-[#202024]">{t('settings.engine.freq_5m')}</option>
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#2e2e34]">
            <div className="flex items-center gap-1.5">
              <Lock size={12} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('settings.engine.crypto_label')}</span>
            </div>
            
            <div className="relative">
              <input
                type={showZipPassword ? "text" : "password"}
                placeholder={t('settings.engine.crypto_ph')}
                value={zipPassword}
                onChange={(e) => setZipPassword(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-xs bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-slate-800 dark:text-white font-mono font-medium outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
              <button 
                type="button"
                onClick={() => setShowZipPassword(!showZipPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-emerald-500 transition-colors"
              >
                {showZipPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {t('settings.engine.crypto_desc_1')} <strong>{t('settings.engine.crypto_desc_bold')}</strong> {t('settings.engine.crypto_desc_2')}
            </p>
          </div>
        </div>

        {/* 📈 Painel 4: Parâmetros Financeiros & ROI */}
        <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#2e2e34] pb-3">
            <Calculator size={16} style={{ color: accentColor }} />
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {t('settings.roi.title')}
            </h3>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('settings.roi.rate_label')}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">R$</span>
              <input type="number" step="0.5" value={inputRate} onChange={(e) => setInputRate(e.target.value)} className="w-36 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white font-bold outline-none" />
              <span className="text-xs text-slate-400">{t('settings.roi.per_hour')}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              {t('settings.roi.desc_1')} <strong>{t('settings.roi.desc_bold')}</strong> {t('settings.roi.desc_2')}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
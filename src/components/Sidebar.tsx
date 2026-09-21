import React, { useState } from 'react';
import { 
  FolderPlus, 
  FolderSearch, 
  PlayCircle, 
  History, 
  BarChart3, 
  Headphones, 
  Settings, 
  UserCheck, 
  ChevronLeft, 
  ChevronRight,
  Globe 
} from 'lucide-react';
import { LicenseInfo } from '../types';
import { useTranslation } from 'react-i18next';
// ⚡ IMPORTAÇÃO BLINDADA DO ÍCONE
import appIcon from '../assets/app-icon.png';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accentColor: string;
  license: LicenseInfo | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  accentColor,
  license 
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { t, i18n } = useTranslation();

  const getLicenseDetails = () => {
    if (!license || !license.is_activated || !license.plan_name) {
      return { label: 'Community', color: 'purple' };
    }
    
    const p = String(license.plan_name).toLowerCase();
    
    if (p.includes('enterprise') || p.includes('master')) {
      return { label: 'Enterprise', color: 'blue' };
    }
    if (p.includes('pro') || p.includes('professional')) {
      return { label: 'Pro', color: 'amber' };
    }
    if (p.includes('basic') || p.includes('core')) {
      return { label: 'Basic', color: 'emerald' };
    }
    
    return { label: 'Basic', color: 'emerald' };
  };

  const navItems = [
    { id: 'builder', label: t('sidebar.rules'), icon: FolderPlus },
    { id: 'explorer', label: t('sidebar.explorer'), icon: FolderSearch },
    { id: 'dryrun', label: t('sidebar.simulation'), icon: PlayCircle },
    { id: 'history', label: t('sidebar.audit'), icon: History },
    { id: 'dashboards', label: t('sidebar.reports'), icon: BarChart3 },
    { id: 'support', label: t('sidebar.support'), icon: Headphones },
  ];

  const { label: planTag, color: planColor } = getLicenseDetails();

  const badgeStyles: Record<string, string> = {
    purple: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    blue: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  };

  return (
    <aside 
      className={`h-screen flex flex-col justify-between p-3 border-r border-slate-200 dark:border-[#2e2e34] bg-white dark:bg-[#18181b] transition-all duration-200 select-none ${
        collapsed ? 'w-16' : 'w-72 lg:w-80'
      }`}
    >
      <div className="space-y-4">
        
        {/* Topo com Logo, Nome Horizontal e Licença embaixo */}
        <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between'} px-1 py-1`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <img 
                src={appIcon} 
                alt="Foldex Automate Logo" 
                className="w-full h-full object-contain drop-shadow-md" 
              />
            </div>

            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-[12px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  FOLDEX AUTOMATE
                </span>
                <div className="flex items-center mt-0.5">
                  <span 
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md border leading-none ${badgeStyles[planColor]}`}
                  >
                    {planTag}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272a] transition-colors shrink-0"
            title={collapsed ? 'Expandir Menu' : 'Recolher Menu'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navegação */}
        <nav className="space-y-1 mt-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272a]'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                style={isActive ? { backgroundColor: accentColor } : {}}
                title={collapsed ? item.label : undefined}
              >
                <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Inferior */}
      <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-[#2e2e34]">
        
        {/* Seletor de Idiomas Inteligente e 100% Dark Mode */}
        <div 
          className={`flex items-center gap-3 px-3 py-2 mb-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-[#202024] border border-slate-200 dark:border-[#2e2e34] ${collapsed ? 'justify-center px-0 border-transparent bg-transparent' : ''}`}
          title={collapsed ? 'Mudar Idioma' : undefined}
        >
          <Globe size={16} className="text-slate-500 shrink-0" />
          {!collapsed && (
            <select
              value={i18n.language}
              onChange={(e) => {
                const selectedLang = e.target.value;
                i18n.changeLanguage(selectedLang);
                localStorage.setItem('foldex_language', selectedLang); 
              }}
              className="bg-transparent text-slate-700 dark:text-slate-300 font-bold outline-none cursor-pointer w-full dark:[color-scheme:dark]"
            >
              <option className="bg-white dark:bg-[#202024] text-slate-800 dark:text-slate-200 font-semibold" value="pt-BR">Português (BR)</option>
              <option className="bg-white dark:bg-[#202024] text-slate-800 dark:text-slate-200 font-semibold" value="pt-PT">Português (PT)</option>
              <option className="bg-white dark:bg-[#202024] text-slate-800 dark:text-slate-200 font-semibold" value="en">English (US)</option>
              <option className="bg-white dark:bg-[#202024] text-slate-800 dark:text-slate-200 font-semibold" value="es">Español</option>
              <option className="bg-white dark:bg-[#202024] text-slate-800 dark:text-slate-200 font-semibold" value="fr">Français</option>
            </select>
          )}
        </div>

        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'settings'
              ? 'text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272a]'
          } ${collapsed ? 'justify-center px-0' : ''}`}
          style={activeTab === 'settings' ? { backgroundColor: accentColor } : {}}
          title={collapsed ? t('sidebar.settings') : undefined}
        >
          <Settings size={16} className="shrink-0" />
          {!collapsed && <span className="truncate">{t('sidebar.settings')}</span>}
        </button>

        <button
          onClick={() => setActiveTab('account')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'account'
              ? 'text-white font-bold shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272a]'
          } ${collapsed ? 'justify-center px-0' : ''}`}
          style={activeTab === 'account' ? { backgroundColor: accentColor } : {}}
          title={collapsed ? t('sidebar.account') : undefined}
        >
          <UserCheck size={16} className="shrink-0" />
          {!collapsed && <span className="truncate">{t('sidebar.account')}</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
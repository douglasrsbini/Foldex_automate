import React, { useState } from 'react';
import { 
  Headphones, 
  Mail, 
  MessageSquare, 
  Globe, 
  FileQuestion, 
  ExternalLink,
  ShieldCheck,
  Sparkles,
  BookOpen,
  FolderPlus,
  Zap,
  FlaskConical,
  History,
  FolderArchive,
  ChevronRight,
  Search
} from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ⚡ Óculos Mágicos

interface SupportViewProps {
  accentColor: string;
  onOpenTour?: () => void;
}

export const SupportView: React.FC<SupportViewProps> = ({ accentColor, onOpenTour }) => {
  const { t } = useTranslation(); // ⚡ Instância do tradutor ativada

  const [activeManualTopic, setActiveManualTopic] = useState<string>('intro');
  const [manualSearch, setManualSearch] = useState('');

  // ⚡ Tópicos renderizados de forma limpa usando fragmentos de tradução para manter os bolds <strong>
  const manualTopics = [
    {
      id: 'intro',
      title: t('support.topics.intro_title'),
      icon: BookOpen,
      content: (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            {t('support.topics.intro_h4')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong>Binaver Foldex</strong> {t('support.topics.intro_p1_1')}
          </p>
          <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 space-y-2">
            <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200 block">
              {t('support.topics.intro_badge')}
            </span>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <li>{t('support.topics.intro_li1')}</li>
              <li>{t('support.topics.intro_li2')}</li>
              <li>{t('support.topics.intro_li3')}</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'rules',
      title: t('support.topics.rules_title'),
      icon: FolderPlus,
      content: (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            {t('support.topics.rules_h4')}
          </h4>
          <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5 list-decimal pl-4">
            <li><strong>{t('support.topics.rules_li1_strong')}</strong> {t('support.topics.rules_li1_text')}</li>
            <li><strong>{t('support.topics.rules_li2_strong')}</strong> {t('support.topics.rules_li2_text')}</li>
            <li><strong>{t('support.topics.rules_li3_strong')}</strong> {t('support.topics.rules_li3_text')}</li>
            <li><strong>{t('support.topics.rules_li4_strong')}</strong> {t('support.topics.rules_li4_text')}</li>
            <li><strong>{t('support.topics.rules_li5_strong')}</strong> {t('support.topics.rules_li5_text')}</li>
            <li><strong>{t('support.topics.rules_li6_strong')}</strong> {t('support.topics.rules_li6_text')}</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'autopilot',
      title: t('support.topics.autopilot_title'),
      icon: Zap,
      content: (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            {t('support.topics.autopilot_h4')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong>{t('support.topics.autopilot_strong')}</strong> {t('support.topics.autopilot_p1_1')}
          </p>
          <div className="p-3.5 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e34] space-y-2">
            <span className="text-xs font-bold text-slate-800 dark:text-white block">{t('support.topics.autopilot_badge')}</span>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {t('support.topics.autopilot_p2_1')} <strong>{t('support.topics.autopilot_p2_strong1')}</strong>{t('support.topics.autopilot_p2_2')} <code>{t('support.topics.autopilot_p2_code1')}</code>{t('support.topics.autopilot_p2_3')}<code>{t('support.topics.autopilot_p2_code2')}</code>{t('support.topics.autopilot_p2_4')}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'simulation',
      title: t('support.topics.sim_title'),
      icon: FlaskConical,
      content: (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            {t('support.topics.sim_h4')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Use a tela de <strong>{t('support.topics.sim_strong')}</strong> {t('support.topics.sim_p1_1')}
          </p>
        </div>
      ),
    },
    {
      id: 'rollback',
      title: t('support.topics.roll_title'),
      icon: History,
      content: (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            {t('support.topics.roll_h4')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('support.topics.roll_p1_1')} <strong>{t('support.topics.roll_strong1')}</strong> {t('support.topics.roll_p1_2')} <strong>{t('support.topics.roll_strong2')}</strong> {t('support.topics.roll_p1_3')}
          </p>
        </div>
      ),
    },
    {
      id: 'zip',
      title: t('support.topics.zip_title'),
      icon: FolderArchive,
      content: (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            {t('support.topics.zip_h4')}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('support.topics.zip_p1_1')} <strong>{t('support.topics.zip_strong1')}</strong>{t('support.topics.zip_p1_2')} <strong>{t('support.topics.zip_strong2')}</strong>
          </p>
        </div>
      ),
    },
  ];

  const filteredTopics = manualTopics.filter(tItem => 
    tItem.title.toLowerCase().includes(manualSearch.toLowerCase()) || 
    tItem.id.toLowerCase().includes(manualSearch.toLowerCase())
  );

  const selectedTopic = manualTopics.find(tItem => tItem.id === activeManualTopic) || manualTopics[0];

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1 select-none w-full">
      
      {/* Cabeçalho */}
      <div className="p-4 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Headphones size={18} style={{ color: accentColor }} />
          <div>
            <h2 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {t('support.header_title')}
            </h2>
            <p className="text-[11px] text-slate-400">{t('support.header_subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenTour && (
            <button
              onClick={onOpenTour}
              className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 border border-blue-200 dark:border-blue-800 transition-colors"
            >
              <Sparkles size={14} />
              <span>{t('support.btn_tour')}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-50 dark:bg-green-950/40 text-green-600 border border-green-200 dark:border-green-800">
            <ShieldCheck size={14} />
            <span>{t('support.badge_enterprise')}</span>
          </div>
        </div>
      </div>

      {/* Manual Interativo do Usuário */}
      <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-[#2e2e34] pb-3 gap-2">
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: accentColor }} />
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {t('support.manual_title')}
            </h3>
          </div>

          <div className="relative w-60">
            <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder={t('support.manual_search_ph')}
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 space-y-1 pr-1 border-b md:border-b-0 md:border-r border-slate-100 dark:border-[#2e2e34] pb-2 md:pb-0">
            {filteredTopics.map((topic) => {
              const Icon = topic.icon;
              const isActive = activeManualTopic === topic.id;
              return (
                <button
                  key={topic.id}
                  onClick={() => setActiveManualTopic(topic.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold border border-blue-200 dark:border-blue-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#27272a]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon size={14} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="truncate">{topic.title}</span>
                  </div>
                  <ChevronRight size={13} className={isActive ? 'text-blue-600' : 'text-slate-300'} />
                </button>
              );
            })}
          </div>

          <div className="md:col-span-8 p-4 bg-slate-50/70 dark:bg-[#18181b] rounded-2xl border border-slate-200 dark:border-[#2e2e34] overflow-y-auto max-h-80">
            {selectedTopic.content}
          </div>
        </div>
      </div>

      {/* Cartões de Canais de Suporte */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* E-mail Corporativo */}
        <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Mail size={18} />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white">{t('support.channels.email_title')}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">{t('support.channels.email_desc')}</p>
            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">contato@binaver.com</p>
          </div>

          <button
            onClick={() => window.open('mailto:contato@binaver.com', '_blank')}
            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#383840] flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>{t('support.channels.email_btn')}</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {/* WhatsApp Corporativo */}
        <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white">{t('support.channels.wpp_title')}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">{t('support.channels.wpp_desc')}</p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('support.channels.wpp_hours')}</p>
          </div>

          <button
            onClick={() => window.open('https://binaver.com', '_blank')}
            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#383840] flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>{t('support.channels.wpp_btn')}</span>
            <ExternalLink size={12} />
          </button>
        </div>

        {/* Portal Oficial */}
        <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <Globe size={18} />
            </div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white">{t('support.channels.portal_title')}</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">{t('support.channels.portal_desc')}</p>
            <p className="text-xs font-mono font-bold text-blue-500">https://binaver.com</p>
          </div>

          <button
            onClick={() => window.open('https://binaver.com', '_blank')}
            className="w-full py-2 rounded-xl text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all"
            style={{ backgroundColor: accentColor }}
          >
            <span>{t('support.channels.portal_btn')}</span>
            <ExternalLink size={12} />
          </button>
        </div>

      </div>

      {/* FAQ */}
      <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#2e2e34] pb-3">
          <FileQuestion size={16} style={{ color: accentColor }} />
          <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            {t('support.faq.title')}
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e34] space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-white">{t('support.faq.q1')}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              {t('support.faq.a1_1')} <strong>{t('support.faq.a1_strong1')}</strong> {t('support.faq.a1_2')} <strong>{t('support.faq.a1_strong2')}</strong> {t('support.faq.a1_3')}
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e34] space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-white">{t('support.faq.q2')}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              {t('support.faq.a2_1')} <em>{t('support.faq.a2_em')}</em> {t('support.faq.a2_2')} <strong>{t('support.faq.a2_strong1')}</strong>{t('support.faq.a2_3')}
            </p>
          </div>
        </div>
      </div>

      {/* Rodapé Institucional */}
      <div className="p-4 bg-slate-50 dark:bg-[#18181b] rounded-2xl border border-slate-200 dark:border-[#2e2e34] text-center text-xs text-slate-400">
        {t('support.footer')} <strong>{t('support.footer_company')}</strong> • {t('support.footer_location')}
      </div>

    </div>
  );
};

export default SupportView;
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Rule, RuleFilter, LicenseInfo } from '../types';
import { 
  Plus, Trash2, ArrowUp, ArrowDown, Save, Edit3, FolderSearch, 
  ListOrdered, Search, Filter, ArrowUpDown, PanelRightClose, 
  PanelRightOpen, Bot, ShieldAlert, Folder, FolderPlus, Wand2, 
  HelpCircle, RotateCcw, FolderDown, FileSpreadsheet, 
  Image as ImageIcon, Archive, X, 
  Sparkles, LayoutGrid, Rows, RefreshCw, Layers, Send, Lock, Eraser, Code, FileSearch, Info, FileText, ArrowRight, CornerDownRight, Building, User, Users, FileCheck, Receipt, Eye,
  ArrowLeft, CheckCircle2, ChevronRight, ChevronDown, ShieldCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ENABLE_AI_FEATURES = false; 

interface RuleBuilderProps {
  initialSource?: string;
  accentColor: string;
  onNavigateToAccount?: () => void;
  userNiche?: string;
}

type SortField = 'id' | 'name';
type SortOrder = 'asc' | 'desc';
type RegexPreset = 'NONE' | 'NUMBERS_ONLY' | 'EXTRACT_CPF' | 'EXTRACT_CNPJ' | 'CLEAN_SCANNER' | 'EXTRACT_DATE' | 'EXTRACT_MATRICULA' | 'CUSTOM';

export const RuleBuilder: React.FC<RuleBuilderProps> = ({ initialSource, accentColor, onNavigateToAccount, userNiche }) => {
  const { t } = useTranslation(); 

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [furthestStep, setFurthestStep] = useState<number>(0);

  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [sourceDir, setSourceDir] = useState(initialSource || '');
  
  const [fileKind, setFileKind] = useState<string>(''); 
  const [filters, setFilters] = useState<RuleFilter[]>([
    { field_name: 'Extensão', operator: 'CONTÉM', value: 'pdf', logic_connector: 'AND' }
  ]);
  
  const [actionType, setActionType] = useState('MOVE');
  const [targetDir, setTargetDir] = useState('');
  const [folderMode, setFolderMode] = useState<'existente' | 'criar'>('existente');
  const [createPattern, setCreatePattern] = useState('{ano}/{mes}');
  const [subfolderPreset, setSubfolderPreset] = useState('fixed');
  
  const [conflictPolicy, setConflictPolicy] = useState('AUTONUMBER');
  const [cleanAccents, setCleanAccents] = useState(false);
  const [replaceSpaces, setReplaceSpaces] = useState(false);
  const [caseFormat, setCaseFormat] = useState('NONE'); 
  const [regexPreset, setRegexPreset] = useState<RegexPreset>('NONE');
  const [regexPattern, setRegexPattern] = useState('');
  const [regexReplacement, setRegexReplacement] = useState('');
  
  const [customCode, setCustomCode] = useState('');
  const [autoCode, setAutoCode] = useState(true);
  const [enableSentinel, setEnableSentinel] = useState(false);

  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [showAdvancedConditions, setShowAdvancedConditions] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [upsellFeature, setUpsellFeature] = useState<'AUTOPILOT' | 'SMART_ORGANIZE' | null>(null);
  
  const [ruleSearch, setRuleSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const isCorePlan = useMemo(() => {
    if (!license || !license.is_activated) return true;
    const plan = String(license.plan_name || '').toLowerCase();
    return plan.includes('core') || plan.includes('basic');
  }, [license]);

  const masterLogicOperator = useMemo(() => {
    if (!Array.isArray(filters)) return 'AND';
    return filters.some(f => f?.logic_connector === 'OR') ? 'OR' : 'AND';
  }, [filters]);

  const handleMasterLogicChange = (value: string) => {
    setFilters(prev => (Array.isArray(prev) ? prev : []).map(f => ({ ...f, logic_connector: value })));
  };

  const documentCategories = [
    { label: t('rule_builder.categories.image') || 'Imagens (JPG, PNG)', value: 'IMAGEM' },
    { label: t('rule_builder.categories.document') || 'Documentos (PDF, DOCX)', value: 'DOCUMENTO' },
    { label: t('rule_builder.categories.spreadsheet') || 'Planilhas (XLS, CSV)', value: 'PLANILHA' },
    { label: t('rule_builder.categories.compressed') || 'Compactados (ZIP, RAR)', value: 'COMPACTADO' },
    { label: t('rule_builder.categories.media') || 'Mídias (MP4, MP3)', value: 'MIDIA' },
    { label: t('rule_builder.categories.code') || 'Código / Dev', value: 'CODIGO' },
    { label: t('rule_builder.categories.others') || 'Outros', value: 'OUTROS' },
  ];

  const quickTemplates = useMemo(() => {
    const allTemplates = [
      { 
        niches: ['cartorio', 'contabilidade', 'juridico', 'rh', 'geral', 'agro'],
        title: t('rule_builder.templates.clean_scanner.title') || 'Limpar Scanner', badge: 'Mover e Limpar', name: 'Triagem de Digitalizações', 
        description: 'Remove os prefixos padronizados de scanners (SCAN_, DOC_) dos arquivos PDF.', 
        icon: Eraser, filter: { field_name: 'Nome do Arquivo', operator: 'COMEÇA COM', value: 'SCAN', logic_connector: 'OR' }, pattern: 'Arquivos_Limpos', action: 'MOVE', regexPreset: 'CLEAN_SCANNER' as RegexPreset 
      },
      { 
        niches: ['cartorio', 'juridico', 'agro'],
        title: t('rule_builder.templates.extract_matricula.title') || 'Extrair Matrículas', badge: 'Renomear', name: 'Padronizar Matrículas', 
        description: 'Busca a numeração da matrícula no nome do arquivo e renomeia.', 
        icon: FileSearch, filter: { field_name: 'Extensão', operator: 'CONTÉM', value: 'pdf', logic_connector: 'AND' }, pattern: 'Matriculas', action: 'MOVE', regexPreset: 'EXTRACT_MATRICULA' as RegexPreset 
      },
      { 
        niches: ['cartorio', 'contabilidade', 'juridico', 'agro'],
        title: t('rule_builder.templates.extract_cnpj.title') || 'Triagem por CNPJ', badge: 'Renomear', name: 'Isolar Empresas (CNPJ)', 
        description: 'Extrai o CNPJ dos arquivos e move para uma pasta de Empresas.', 
        icon: Building, filter: { field_name: 'Extensão', operator: 'CONTÉM', value: 'pdf', logic_connector: 'AND' }, pattern: 'Empresas/{ano}', action: 'MOVE', regexPreset: 'EXTRACT_CNPJ' as RegexPreset, replaceSpaces: true, cleanAccents: true 
      },
      { 
        niches: ['cartorio', 'contabilidade', 'juridico', 'rh', 'agro'],
        title: t('rule_builder.templates.extract_cpf.title') || 'Triagem por CPF', badge: 'Renomear', name: 'Isolar Clientes (CPF)', 
        description: 'Localiza o CPF no nome do arquivo, padroniza e organiza.', 
        icon: User, filter: { field_name: 'Extensão', operator: 'CONTÉM', value: 'pdf', logic_connector: 'AND' }, pattern: 'Clientes_Fisicos/{ano}', action: 'MOVE', regexPreset: 'EXTRACT_CPF' as RegexPreset 
      },
      { 
        niches: ['juridico', 'contabilidade', 'cartorio', 'rh', 'agro'],
        title: t('rule_builder.templates.isolate_contracts.title') || 'Isolar Contratos', badge: 'Mover PDF', name: 'Triagem de Contratos', 
        description: 'Filtra tudo o que for Contrato e remove espaços do nome.', 
        icon: FileCheck, filter: { field_name: 'Nome do Arquivo', operator: 'CONTÉM', value: 'contrato', logic_connector: 'OR' }, pattern: 'Juridico_Contratos/{ano}', action: 'MOVE', cleanAccents: true, replaceSpaces: true 
      },
      { 
        niches: ['contabilidade', 'geral', 'agro'],
        title: t('rule_builder.templates.receipts.title') || 'Comprovantes e Pix', badge: 'Mover Tudo', name: 'Triagem Financeira', 
        description: 'Organiza recibos e comprovantes em pastas separadas por mês.', 
        icon: Receipt, filter: { field_name: 'Nome do Arquivo', operator: 'CONTÉM', value: 'comprovante,recibo,pix', logic_connector: 'OR' }, pattern: 'Comprovantes/{ano}/{mes}', action: 'MOVE' 
      },
      { 
        niches: ['contabilidade', 'geral', 'agro'],
        title: t('rule_builder.templates.extract_xml.title') || 'Notas Fiscais XML', badge: 'Mover XML', name: 'Triagem de Notas Fiscais (NFe)', 
        description: 'Localiza e separa todos os arquivos .xml soltos.', 
        icon: Code, filter: { field_name: 'Extensão', operator: 'É IGUAL A', value: 'xml', logic_connector: 'AND' }, pattern: 'Notas_Fiscais_XML/{ano}/{mes}', action: 'MOVE' 
      },
      { 
        niches: ['agro', 'cartorio', 'geral'],
        title: t('rule_builder.templates.agro_tickets.title') || 'Romaneios / Tickets', badge: 'Mover Todos', name: 'Organização de Romaneios', 
        description: 'Filtra arquivos contendo romaneio ou ticket.', 
        icon: FileText, filter: { field_name: 'Nome do Arquivo', operator: 'CONTÉM', value: 'romaneio,ticket,pesagem', logic_connector: 'OR' }, pattern: 'Romaneios_Agro/{ano}', action: 'MOVE' 
      },
      { 
        niches: ['geral', 'rh', 'agro'],
        title: t('rule_builder.templates.downloads_month.title') || 'Downloads por Mês', badge: 'Dinâmico', name: 'Limpeza de Downloads', 
        description: 'Agrupa os arquivos por Ano e Mês automaticamente.', 
        icon: FolderDown, filter: { field_name: 'Extensão', operator: 'CONTÉM', value: 'pdf,xlsx,docx,jpg,png', logic_connector: 'AND' }, pattern: '{ano}/{mes}', action: 'MOVE' 
      }
    ];

    if (!userNiche || userNiche === 'geral') {
      return allTemplates.filter(t => t.niches.includes('geral'));
    }
    
    return allTemplates.filter(t => t.niches.includes(userNiche));
  }, [userNiche, t]);

  useEffect(() => {
    loadRules();
    invoke<LicenseInfo>('get_license_status').then(setLicense).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialSource) setSourceDir(initialSource);
  }, [initialSource]);

  useEffect(() => {
    if (regexPreset === 'NONE') {
      setRegexPattern(''); setRegexReplacement('');
    } else if (regexPreset === 'NUMBERS_ONLY') {
      setRegexPattern('[^0-9]'); setRegexReplacement('');
    } else if (regexPreset === 'EXTRACT_CPF') {
      setRegexPattern('.*?(\\d{11}).*'); setRegexReplacement('CPF_$1');
    } else if (regexPreset === 'EXTRACT_CNPJ') {
      setRegexPattern('.*?(\\d{14}).*'); setRegexReplacement('CNPJ_$1');
    } else if (regexPreset === 'CLEAN_SCANNER') {
      setRegexPattern('(?i)^(?:SCAN|DOC|IMG)[_\\-]?(.*)'); setRegexReplacement('$1');
    } else if (regexPreset === 'EXTRACT_DATE') {
      setRegexPattern('.*?(\\d{2,4}[-/]\\d{2}[-/]\\d{2,4}).*'); setRegexReplacement('Data_$1');
    } else if (regexPreset === 'EXTRACT_MATRICULA') {
      setRegexPattern('.*?(\\d{5,7}).*'); setRegexReplacement('Matricula_$1');
    }
  }, [regexPreset]);

  const handleFileKindChange = (val: string) => {
    setFileKind(val);
    if (val === 'ALL') {
      setFilters([{ field_name: 'Extensão', operator: 'CONTÉM', value: '', logic_connector: 'AND' }]);
      setShowAdvancedConditions(false);
    } else if (val === 'CUSTOM') {
      setShowAdvancedConditions(true);
    } else if (val !== '') {
      setFilters([{ field_name: 'Tipo de Documento (Categoria)', operator: 'É IGUAL A', value: val, logic_connector: 'AND' }]);
      setShowAdvancedConditions(false);
    }
  };

  const handleSubfolderPresetChange = (val: string) => {
    setSubfolderPreset(val);
    if (val === 'fixed') {
      setFolderMode('existente');
    } else if (val === 'yearmonth') {
      setFolderMode('criar');
      setCreatePattern('{ano}/{mes}');
    } else if (val === 'category') {
      setFolderMode('criar');
      setCreatePattern('{tipo_doc}');
    } else if (val === 'custom') {
      setFolderMode('criar');
    }
  };

  const simulatedName = useMemo(() => {
    let name = t('rule_builder.mock_filename') || 'SCAN_relatório financeiro 12345';
    
    if (regexPreset === 'EXTRACT_CPF') name = 'Documento_00000000000';
    else if (regexPreset === 'EXTRACT_CNPJ') name = 'Empresa_12345678000199';
    else if (regexPreset === 'EXTRACT_MATRICULA') name = 'Matricula_88542';
    
    let ext = ".pdf";

    if (regexPattern && regexReplacement !== undefined) {
      try {
        const re = new RegExp(regexPattern, 'i');
        name = name.replace(re, regexReplacement);
      } catch (e) {}
    }

    if (cleanAccents) {
      name = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    
    if (replaceSpaces) {
      name = name.replace(/\s+/g, "_");
    }

    if (caseFormat === 'UPPER') {
      name = name.toUpperCase();
    } else if (caseFormat === 'LOWER') {
      name = name.toLowerCase();
    }

    return name + ext;
  }, [cleanAccents, replaceSpaces, caseFormat, regexPattern, regexReplacement, regexPreset, t]);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const res = await invoke<Rule[]>('get_rules');
      setRules(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;

    const apiKey = localStorage.getItem('foldex_gemini_key');
    if (!apiKey) {
      alert("Acesso Negado: A chave da IA não foi encontrada. Acesse 'Configurações'.");
      return;
    }

    setIsAiLoading(true);
    try {
      const jsonStr = await invoke<string>('generate_rule_via_ai', { prompt: aiPrompt, apiKey: apiKey.trim() });
      const data = JSON.parse(jsonStr);

      if (data.ruleName) setRuleName(data.ruleName);
      if (data.actionType) setActionType(data.actionType);
      if (data.targetDir) {
        setSubfolderPreset('custom');
        setFolderMode('criar');
        setCreatePattern(data.targetDir);
      }
      if (data.filters && Array.isArray(data.filters)) {
        setFilters(data.filters);
        setFileKind('CUSTOM');
        setShowAdvancedConditions(true);
      }

      setAiPrompt('');
      alert("Regra gerada com sucesso pela Inteligência Artificial!");
    } catch (e) {
      alert(`Falha ao gerar regra: ${e}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const selectSourceFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Selecionar pasta de origem' });
      if (selected && typeof selected === 'string') setSourceDir(selected);
    } catch (e) { alert(`Erro: ${e}`); }
  };

  const selectTargetFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Selecionar pasta de destino' });
      if (selected && typeof selected === 'string') setTargetDir(selected);
    } catch (e) { alert(`Erro: ${e}`); }
  };

  const applyTemplate = (tTemplate: any) => {
    resetForm();
    setRuleName(tTemplate.name); 
    if (tTemplate.pattern) {
      setFolderMode('criar');
      setCreatePattern(tTemplate.pattern);
      setSubfolderPreset('custom');
    } else {
      setFolderMode('existente');
      setSubfolderPreset('fixed');
    }
    setActionType(tTemplate.action);
    setFilters([tTemplate.filter]);
    
    if (tTemplate.all) {
      setFileKind('ALL');
    } else if (tTemplate.filter.field_name === 'Tipo de Documento (Categoria)') {
      setFileKind(tTemplate.filter.value);
    } else {
      setFileKind('CUSTOM');
      setShowAdvancedConditions(true);
    }

    setRegexPreset(tTemplate.regexPreset || 'NONE');
    setCleanAccents(tTemplate.cleanAccents || false);
    setReplaceSpaces(tTemplate.replaceSpaces || false);
    setCaseFormat(tTemplate.caseFormat || 'NONE');
    
    setIsTemplatesModalOpen(false);
    setCurrentStep(0);
    setFurthestStep(0);
  };

  const addFilterRow = () => {
    setFilters([...(Array.isArray(filters) ? filters : []), { field_name: 'Extensão', operator: 'CONTÉM', value: '', logic_connector: masterLogicOperator }]);
  };

  const removeFilterRow = (idx: number) => {
    if (!Array.isArray(filters) || filters.length <= 1) return;
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const handleToggleAutoPilot = async (rule: Rule) => {
    if (isCorePlan) {
      setUpsellFeature('AUTOPILOT');
      return;
    }
    try {
      const nextState = !rule.is_sentinel_active;
      await invoke('toggle_sentinel_rule', { ruleId: rule.id, active: nextState });
      loadRules();
    } catch (e) {
      alert(e);
    }
  };

  const validateStep = (step: number) => {
    if (step === 0 && !ruleName.trim()) {
      setFormError("Por favor, informe um nome para a regra.");
      return false;
    }
    if (step === 1 && !sourceDir.trim()) {
      setFormError("Selecione a pasta de origem onde os arquivos estão.");
      return false;
    }
    if (step === 2) {
      if (!fileKind && !showAdvancedConditions) {
        setFormError("Escolha um tipo de arquivo ou configure uma regra avançada.");
        return false;
      }
      if (showAdvancedConditions && Array.isArray(filters) && filters.some(f => !String(f?.value || '').trim() && f?.field_name !== 'Extensão' && f?.field_name !== 'Tipo de Documento (Categoria)')) {
        setFormError("Preencha todos os campos das condições avançadas.");
        return false;
      }
    }
    if (step === 3 && actionType !== 'DELETE' && actionType !== 'RENAME') {
      if (folderMode === 'existente' && !targetDir.trim()) {
        setFormError("Selecione a pasta de destino.");
        return false;
      }
      if (folderMode === 'criar' && !createPattern.trim()) {
        setFormError("Informe o padrão de subpastas a ser criado.");
        return false;
      }
    }
    setFormError(null);
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const next = currentStep + 1;
      setCurrentStep(next);
      if (next > furthestStep) setFurthestStep(next);
    }
  };

  const handleSaveRuleToBackend = async () => {
    if (!validateStep(3)) return;

    if (license && !license.is_activated && rules.length >= license.max_rules && !editingId) {
      alert(`Você atingiu o limite do Modo Demonstração (${license.max_rules} regras).`);
      return;
    }

    const finalTarget = folderMode === 'existente' ? targetDir : `${sourceDir}/${createPattern}`;
    const code = autoCode ? (rules.length + 1).toString() : customCode.trim();

    const newRule: Rule = {
      id: editingId || undefined,
      custom_code: code.toString(),
      name: ruleName.trim(),
      source_directory: sourceDir.trim(),
      logic_operator: masterLogicOperator,
      is_active: true,
      is_sentinel_active: enableSentinel,
      conflict_policy: conflictPolicy,
      filters: Array.isArray(filters) ? filters : [],
      actions: [{ 
        action_type: actionType, 
        target_pattern: finalTarget.trim(),
        clean_accents: cleanAccents,
        replace_spaces: replaceSpaces,
        case_format: caseFormat,
        regex_pattern: regexPattern,
        regex_replacement: regexReplacement
      }]
    };

    try {
      await invoke('save_rule', { rule: newRule });
      alert("Regra configurada e salva com sucesso!");
      resetForm();
      loadRules();
      setIsRulesModalOpen(true);
    } catch (e) {
      alert(`Falha ao salvar regra: ${e}`);
    }
  };

  const handleSave = async () => {
    // Se não está no último passo (Automação), vai para o próximo passo
    if (currentStep < 5) {
      nextStep();
    } else {
      // Se está no passo de automação, salva a regra
      await handleSaveRuleToBackend();
    }
  };

  const resetForm = () => {
    setEditingId(null); 
    setRuleName(''); 
    setCustomCode(''); 
    setAutoCode(true); 
    setSourceDir(initialSource || '');
    setTargetDir(''); 
    setConflictPolicy('AUTONUMBER'); 
    setFolderMode('existente');
    setSubfolderPreset('fixed');
    setCreatePattern('{ano}/{mes}');
    setFileKind('');
    setShowAdvancedConditions(false);
    setShowAdvancedActions(false);
    setFilters([{ field_name: 'Extensão', operator: 'CONTÉM', value: 'pdf', logic_connector: 'AND' }]);
    setCleanAccents(false);
    setReplaceSpaces(false);
    setCaseFormat('NONE');
    setRegexPreset('NONE');
    setRegexPattern('');
    setRegexReplacement('');
    setCurrentStep(0);
    setFurthestStep(0);
    setFormError(null);
    setEnableSentinel(false);
  };

  // ⚡ BLINDAGEM CONTRA FALHAS DO BANCO: null-safety total para não "crashar" o React.
  const filteredAndSortedRules = useMemo(() => {
    if (!Array.isArray(rules)) return [];
    
    let list = rules.filter(r => {
      const matchSearch = String(r?.name || '').toLowerCase().includes(ruleSearch.toLowerCase()) || 
                          String(r?.custom_code || '').toLowerCase().includes(ruleSearch.toLowerCase()) ||
                          String(r?.source_directory || '').toLowerCase().includes(ruleSearch.toLowerCase());
      
      const safeActions = Array.isArray(r?.actions) ? r.actions : [];
      const matchAction = actionFilter === 'ALL' || safeActions.some(a => a?.action_type === actionFilter);
      
      return matchSearch && matchAction;
    });

    list.sort((a, b) => {
      let res = 0;
      if (sortField === 'id') {
        res = String(a?.custom_code || '').localeCompare(String(b?.custom_code || ''), undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'name') {
        res = String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortOrder === 'asc' ? res : -res;
    });

    return list;
  }, [rules, ruleSearch, actionFilter, sortField, sortOrder]);

  const stepNames = ["Nome", "Origem", "Condições", "Ação e destino", "Revisão", "Automação"];

  return (
    <div className="flex flex-col h-full w-full select-none max-w-7xl mx-auto overflow-hidden">
      
      {/* 🌟 CABEÇALHO DO WIZARD */}
      <div className="flex items-center justify-between px-6 py-5 shrink-0 bg-transparent">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
            {editingId ? 'Editar Regra' : 'Criar uma regra'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">Uma etapa de cada vez. Você pode voltar e ajustar quando precisar.</p>
        </div>
        <div className="flex items-center gap-2">
          {!editingId && (
            <button 
              onClick={() => setIsTemplatesModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-[#1e1e24] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-[#2e2e34] shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex items-center gap-2"
            >
              <Layers size={14} className="text-blue-500" /> Usar modelo
            </button>
          )}
          {editingId && (
            <button 
              onClick={resetForm}
              className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors flex items-center gap-2"
            >
              <X size={14} /> Cancelar
            </button>
          )}
          <button 
            onClick={() => setIsRulesModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#202024] text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-[#2e2e34] hover:bg-slate-200 dark:hover:bg-[#27272a] transition-colors flex items-center gap-2"
          >
            <ListOrdered size={14} /> Minhas regras <span className="bg-slate-200 dark:bg-[#2e2e34] px-1.5 py-0.5 rounded text-[10px]">{Array.isArray(rules) ? rules.length : 0}</span>
          </button>
        </div>
      </div>

      {/* 🌟 BARRA DE PROGRESSO */}
      <div className="px-6 shrink-0 mb-6 hidden sm:block">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-slate-200 dark:bg-[#2e2e34] z-0"></div>
          {stepNames.map((name, idx) => {
            const isCompleted = idx < currentStep;
            const isActive = idx === currentStep;
            const isAccessible = idx <= furthestStep;
            
            return (
              <div 
                key={idx} 
                onClick={() => { if (isAccessible) setCurrentStep(idx); }}
                className={`relative z-10 flex flex-col items-center gap-2 ${isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
                  isActive ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_0_4px_rgba(37,99,235,0.15)] scale-110' : 
                  isCompleted ? 'bg-slate-800 dark:bg-[#18181b] border-slate-700 dark:border-[#383840] text-emerald-400' : 
                  'bg-white dark:bg-[#18181b] border-slate-300 dark:border-[#383840] text-slate-400'
                }`}>
                  {isCompleted ? <CheckCircle2 size={16} /> : (idx + 1)}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-slate-800 dark:text-white' : 'text-slate-500'}`}>
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 CORPO DO WIZARD (PAINEL CENTRAL + GUIA LATERAL) */}
      <div className="flex-1 px-6 pb-6 overflow-hidden flex gap-8">
        
        {/* Painel Esquerdo (Formulário) */}
        <div className="flex-1 bg-white dark:bg-[#191c22] rounded-2xl border border-slate-200 dark:border-[#2a2e37] shadow-sm flex flex-col overflow-hidden">
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
            
            {/* ETAPA 0: NOME */}
            {currentStep === 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-xl mx-auto space-y-6 pt-4">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Edit3 size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Vamos começar pelo nome</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Como você quer chamar esta regra?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Escolha um nome que explique o que ela vai fazer. Assim, fica fácil encontrá-la depois na lista.
                </p>

                <div className="space-y-2 mt-6">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nome da regra</label>
                  <input 
                    type="text" 
                    placeholder="Ex.: Separar notas fiscais"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && nextStep()}
                    className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl text-slate-800 dark:text-white font-medium outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-2">Esse nome é só para sua organização. Ele não muda o nome dos arquivos em si.</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-4">
                  <span className="text-[10px] text-slate-500">Experimente:</span>
                  <button onClick={() => setRuleName('Separar documentos PDF')} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#343a45] text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 transition-colors">Separar documentos PDF</button>
                  <button onClick={() => setRuleName('Organizar notas fiscais')} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#343a45] text-[10px] font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 transition-colors">Organizar notas fiscais</button>
                </div>

                {ENABLE_AI_FEATURES && (
                  <div className="mt-8 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                      <Sparkles size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Gerar regra com IA</span>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ex: Mova todos os boletos em PDF para a pasta Financeiro"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
                        disabled={isAiLoading}
                        className="flex-1 px-3 py-2 text-xs bg-white dark:bg-[#13161b] border border-indigo-200 dark:border-indigo-900/50 rounded-lg text-slate-800 dark:text-white outline-none focus:border-indigo-500"
                      />
                      <button 
                        onClick={handleGenerateAI}
                        disabled={isAiLoading || !aiPrompt.trim()}
                        className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                      >
                        {isAiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ETAPA 1: ORIGEM */}
            {currentStep === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-xl mx-auto space-y-6 pt-4">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <Folder size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">O ponto de partida</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Onde estão os arquivos bagunçados?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Escolha a pasta que o Foldex Automate deverá observar. É nela que os arquivos chegam antes de serem processados.
                </p>

                <div className="space-y-2 mt-6">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pasta de origem</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Folder size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Ex: C:\Users\Nome\Downloads"
                        value={sourceDir}
                        onChange={(e) => setSourceDir(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 text-sm bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl text-slate-800 dark:text-white font-mono outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <button 
                      onClick={selectSourceFolder}
                      className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#20242c] hover:bg-slate-200 dark:hover:bg-[#2a2e37] border border-slate-200 dark:border-[#343a45] text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2 shrink-0"
                    >
                      <FolderSearch size={16} /> Escolher
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Geralmente é a pasta Downloads, a pasta de um Scanner ou a Área de Trabalho.</p>
                </div>
              </div>
            )}

            {/* ETAPA 2: CONDIÇÕES */}
            {currentStep === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto space-y-6 pt-4">
                <div className="flex items-center gap-2 text-purple-500 mb-2">
                  <Filter size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Filtro principal</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Quais arquivos vamos organizar?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Você pode escolher um tipo de arquivo comum, selecionar todos os arquivos da pasta, ou criar regras avançadas para filtrar nomes, tamanhos e datas.
                </p>

                <div className="space-y-2 mt-6">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tipo de arquivo</label>
                  <select 
                    value={fileKind}
                    onChange={(e) => handleFileKindChange(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl text-slate-800 dark:text-white font-medium outline-none focus:border-purple-500 transition-colors cursor-pointer"
                  >
                    <option value="">Selecione uma opção...</option>
                    <option value="ALL">Todos os arquivos (Sem filtro)</option>
                    {documentCategories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                    <option value="CUSTOM">Personalizado — regras e filtros avançados</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-[#2a2e37] mt-6">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!showAdvancedConditions) setFileKind('CUSTOM');
                      setShowAdvancedConditions(!showAdvancedConditions);
                    }}
                    className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-purple-500 transition-colors w-full"
                  >
                    {showAdvancedConditions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Regras e Filtros Avançados
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-[#20242c] px-2 py-0.5 rounded">
                      Opcional
                    </span>
                  </button>

                  {showAdvancedConditions && (
                    <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">O arquivo deve atender a:</label>
                        <select
                          value={masterLogicOperator}
                          onChange={(e) => handleMasterLogicChange(e.target.value)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-[#13161b] text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-[#343a45] outline-none cursor-pointer"
                        >
                          <option value="AND">Todas as condições</option>
                          <option value="OR">Pelo menos uma condição</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        {Array.isArray(filters) && filters.map((f, idx) => {
                          const isCategory = f?.field_name === 'Tipo de Documento (Categoria)';
                          const isDate = String(f?.field_name || '').includes('Data') || f?.field_name === 'Data de Criação';

                          return (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select 
                                  value={f?.field_name || 'Extensão'}
                                  onChange={(e) => {
                                    const nf = [...filters];
                                    nf[idx].field_name = e.target.value;
                                    if (e.target.value === 'Tipo de Documento (Categoria)') {
                                      nf[idx].value = 'IMAGEM'; nf[idx].operator = 'É IGUAL A';
                                    } else if (e.target.value.includes('Data')) {
                                      nf[idx].operator = 'ESTÁ ENTRE (DATA/HORA)'; nf[idx].value = '';
                                    } else {
                                      nf[idx].value = '';
                                    }
                                    setFilters(nf);
                                  }}
                                  className="px-2 py-1.5 text-xs bg-white dark:bg-[#191c22] border border-slate-200 dark:border-[#2a2e37] rounded-lg text-slate-800 dark:text-white outline-none"
                                >
                                  <option value="Extensão">Extensão (Ex: pdf)</option>
                                  <option value="Tipo de Documento (Categoria)">Categoria Pronta</option>
                                  <option value="Nome do Arquivo">Nome do Arquivo</option>
                                  <option value="Data de Criação">Data de Criação</option>
                                  <option value="Data de Modificação">Data de Modificação</option>
                                  <option value="Tamanho (Bytes)">Tamanho (Bytes)</option>
                                </select>

                                <select 
                                  value={f?.operator || 'CONTÉM'}
                                  onChange={(e) => { const nf = [...filters]; nf[idx].operator = e.target.value; setFilters(nf); }}
                                  className="px-2 py-1.5 text-xs bg-white dark:bg-[#191c22] border border-slate-200 dark:border-[#2a2e37] rounded-lg text-slate-800 dark:text-white outline-none"
                                >
                                  {isCategory ? (
                                    <option value="É IGUAL A">É igual a</option>
                                  ) : isDate ? (
                                    <>
                                      <option value="ESTÁ ENTRE (DATA/HORA)">Está entre as datas</option>
                                      <option value="MAIOR QUE">Maior que (Após)</option>
                                      <option value="MENOR QUE">Menor que (Antes)</option>
                                    </>
                                  ) : (
                                    <>
                                      <option value="CONTÉM">Contém</option>
                                      <option value="É IGUAL A">É igual a</option>
                                      <option value="NÃO É (DIFERENTE DE)">Não é / Diferente</option>
                                      <option value="COMEÇA COM">Começa com</option>
                                      <option value="TERMINA COM">Termina com</option>
                                    </>
                                  )}
                                </select>

                                {isCategory ? (
                                  <select
                                    value={f?.value || 'IMAGEM'}
                                    onChange={(e) => { const nf = [...filters]; nf[idx].value = e.target.value; setFilters(nf); }}
                                    className="px-2 py-1.5 text-xs bg-white dark:bg-[#191c22] border border-slate-200 dark:border-[#2a2e37] rounded-lg text-slate-800 dark:text-white outline-none"
                                  >
                                    {documentCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                  </select>
                                ) : isDate ? (
                                  f?.operator === 'ESTÁ ENTRE (DATA/HORA)' ? (
                                    <div className="flex gap-1">
                                      <input type="date" value={String(f?.value || '').split(',')[0] || ''} onChange={(e) => { const nf = [...filters]; nf[idx].value = `${e.target.value},${String(nf[idx].value || '').split(',')[1] || ''}`; setFilters(nf); }} className="w-1/2 px-2 py-1.5 text-xs bg-white dark:bg-[#191c22] border border-slate-200 dark:border-[#2a2e37] rounded-lg text-slate-800 dark:text-white outline-none dark:[color-scheme:dark]" />
                                      <input type="date" value={String(f?.value || '').split(',')[1] || ''} onChange={(e) => { const nf = [...filters]; nf[idx].value = `${String(nf[idx].value || '').split(',')[0] || ''},${e.target.value}`; setFilters(nf); }} className="w-1/2 px-2 py-1.5 text-xs bg-white dark:bg-[#191c22] border border-slate-200 dark:border-[#2a2e37] rounded-lg text-slate-800 dark:text-white outline-none dark:[color-scheme:dark]" />
                                    </div>
                                  ) : (
                                    <input type="date" value={f?.value || ''} onChange={(e) => { const nf = [...filters]; nf[idx].value = e.target.value; setFilters(nf); }} className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#191c22] border border-slate-200 dark:border-[#2a2e37] rounded-lg text-slate-800 dark:text-white outline-none dark:[color-scheme:dark]" />
                                  )
                                ) : (
                                  <input 
                                    type="text" 
                                    placeholder="Valor da condição"
                                    value={f?.value || ''}
                                    onChange={(e) => { const nf = [...filters]; nf[idx].value = e.target.value; setFilters(nf); }}
                                    className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#191c22] border border-slate-200 dark:border-[#2a2e37] rounded-lg text-slate-800 dark:text-white outline-none"
                                  />
                                )}
                              </div>
                              <button 
                                type="button" 
                                onClick={() => removeFilterRow(idx)} 
                                disabled={filters.length <= 1}
                                className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <button onClick={addFilterRow} className="text-xs font-bold text-purple-500 hover:underline flex items-center gap-1">
                        <Plus size={14} /> Adicionar condição
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ETAPA 3: AÇÃO E DESTINO */}
            {currentStep === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto space-y-6 pt-4">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <ArrowRight size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Defina o próximo destino</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">O que fazer com esses arquivos?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Escolha a ação principal. As opções de subpastas, renomeio e resolução de conflitos estão disponíveis logo abaixo nas configurações avançadas.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ação da regra</label>
                    <select 
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl text-slate-800 dark:text-white font-medium outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      <option value="MOVE">Mover para outra pasta</option>
                      <option value="COPY">Copiar para outra pasta</option>
                      <option value="RENAME">Apenas renomear (na mesma pasta)</option>
                      <option value="ZIP">Compactar em um arquivo ZIP</option>
                      <option value="DELETE">Excluir (Mover para Lixeira)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Organização das subpastas</label>
                    <select 
                      value={subfolderPreset}
                      onChange={(e) => handleSubfolderPresetChange(e.target.value)}
                      disabled={actionType === 'DELETE' || actionType === 'RENAME'}
                      className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl text-slate-800 dark:text-white font-medium outline-none focus:border-blue-500 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <option value="fixed">Manter na pasta exata</option>
                      <option value="yearmonth">Criar subpastas por Ano / Mês</option>
                      <option value="category">Criar subpastas por Categoria</option>
                      <option value="custom">Personalizado avançado...</option>
                    </select>
                  </div>
                </div>

                {actionType !== 'DELETE' && actionType !== 'RENAME' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pasta Base de Destino</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Folder size={16} className="absolute left-3 top-3.5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Ex: C:\Financeiro\Notas"
                          value={targetDir}
                          onChange={(e) => setTargetDir(e.target.value)}
                          className="w-full pl-9 pr-4 py-3 text-sm bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl text-slate-800 dark:text-white font-mono outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                      <button 
                        onClick={selectTargetFolder}
                        className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#20242c] hover:bg-slate-200 dark:hover:bg-[#2a2e37] border border-slate-200 dark:border-[#343a45] text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2 shrink-0"
                      >
                        <FolderSearch size={16} /> Escolher
                      </button>
                    </div>
                    {folderMode === 'criar' && (
                      <div className="mt-2 flex items-center gap-2 bg-blue-50/50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800/30">
                        <CornerDownRight size={14} className="text-blue-500" />
                        <span className="text-[10px] text-blue-700 dark:text-blue-300 font-mono">
                          Padrão interno gerado: <strong className="bg-white dark:bg-[#13161b] px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700">{createPattern}</strong>
                        </span>
                        {subfolderPreset === 'custom' && (
                          <input 
                            value={createPattern} 
                            onChange={e => setCreatePattern(e.target.value)} 
                            className="ml-auto px-2 py-0.5 text-[10px] rounded border outline-none bg-white dark:bg-[#13161b] border-blue-300 dark:border-blue-700 text-slate-800 dark:text-slate-200 font-mono w-32"
                            placeholder="{ano}/{mes}"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-[#2a2e37] mt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowAdvancedActions(!showAdvancedActions)}
                    className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-500 transition-colors w-full"
                  >
                    {showAdvancedActions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Configurações de Nome, IDs e Conflitos
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-[#20242c] px-2 py-0.5 rounded">
                      Opcional
                    </span>
                  </button>

                  {showAdvancedActions && (
                    <div className="mt-4 space-y-5 animate-in fade-in slide-in-from-top-2">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Se já existir um arquivo com mesmo nome</label>
                          <select value={conflictPolicy} onChange={(e) => setConflictPolicy(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl outline-none text-slate-700 dark:text-slate-300 font-medium">
                            <option value="AUTONUMBER">Manter os dois (Adicionar Número)</option>
                            <option value="INCREMENTAL">Mesclar Conteúdo (Avançado)</option>
                            <option value="OVERWRITE">Substituir o Existente (Cuidado)</option>
                            <option value="SKIP">Ignorar e Pular Arquivo</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Código da Regra (ID Interno)</label>
                          <div className="flex gap-2">
                            <input type="text" value={autoCode ? 'FLX-AUTO' : customCode} onChange={(e) => setCustomCode(e.target.value)} disabled={autoCode} className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl outline-none text-slate-700 dark:text-slate-300 font-mono font-bold disabled:opacity-60" />
                            <button onClick={() => setAutoCode(!autoCode)} className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-colors ${autoCode ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-[#20242c] dark:border-[#343a45]'}`}>
                              Auto
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-[#2a2e37]">
                        <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl cursor-pointer">
                          <input type="checkbox" checked={cleanAccents} onChange={(e) => setCleanAccents(e.target.checked)} className="rounded text-blue-600 w-4 h-4" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Remover Acentos (ã -{'>'} a)</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl cursor-pointer">
                          <input type="checkbox" checked={replaceSpaces} onChange={(e) => setReplaceSpaces(e.target.checked)} className="rounded text-blue-600 w-4 h-4" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Trocar Espaços por _</span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Capitalização (Maiúsculas/Minúsculas)</label>
                          <select value={caseFormat} onChange={(e) => setCaseFormat(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl outline-none text-slate-700 dark:text-slate-300 font-medium">
                            <option value="NONE">Manter Original</option>
                            <option value="UPPER">TUDO MAIÚSCULO</option>
                            <option value="LOWER">tudo minúsculo</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Extração por Padrão (Regex)</label>
                          <select value={regexPreset} onChange={(e) => setRegexPreset(e.target.value as RegexPreset)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl outline-none text-slate-700 dark:text-slate-300 font-medium">
                            <option value="NONE">Desativado</option>
                            <option value="EXTRACT_CPF">Extrair CPF do Nome</option>
                            <option value="EXTRACT_CNPJ">Extrair CNPJ do Nome</option>
                            <option value="EXTRACT_MATRICULA">Extrair Matrícula Numérica</option>
                            <option value="EXTRACT_DATE">Extrair Data</option>
                            <option value="CLEAN_SCANNER">Limpar prefixos de Scanner</option>
                            <option value="NUMBERS_ONLY">Manter Somente Números</option>
                          </select>
                        </div>
                      </div>

                      {/* Preview do Nome do Arquivo */}
                      <div className="p-4 bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl flex items-center justify-between gap-4 overflow-hidden">
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Original</p>
                          <p className="text-xs text-slate-500 font-mono truncate">{t('rule_builder.mock_filename') || 'SCAN_relatório financeiro 12345'}.pdf</p>
                        </div>
                        <ArrowRight size={16} className="text-blue-500 shrink-0" />
                        <div className="min-w-0 text-right">
                          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Como vai ficar</p>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono truncate">{simulatedName}</p>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ETAPA 4: REVISÃO */}
            {currentStep === 4 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto space-y-6 pt-4">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                  <CheckCircle2 size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Última conferência</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Está tudo como você imaginou?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Confira as escolhas abaixo. Você pode editar qualquer etapa antes de salvar e ativar a regra no Foldex Automate.
                </p>

                <div className="mt-6 bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-2xl divide-y divide-slate-200 dark:divide-[#2a2e37]">
                  
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex gap-3 items-center">
                      <Edit3 size={18} className="text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Nome da regra</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{ruleName}</p>
                      </div>
                    </div>
                    <button onClick={() => setCurrentStep(0)} className="text-xs font-bold text-blue-500 hover:underline">Editar</button>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex gap-3 items-center">
                      <Folder size={18} className="text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">De onde vêm os arquivos</p>
                        <p className="text-sm font-mono text-slate-800 dark:text-white">{sourceDir}</p>
                      </div>
                    </div>
                    <button onClick={() => setCurrentStep(1)} className="text-xs font-bold text-blue-500 hover:underline">Editar</button>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex gap-3 items-center">
                      <Filter size={18} className="text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Quais arquivos serão escolhidos</p>
                        <p className="text-sm text-slate-800 dark:text-white">
                          {fileKind === 'ALL' ? 'Todos os arquivos sem distinção' : 
                           fileKind !== 'CUSTOM' ? `Arquivos classificados como: ${fileKind}` : 
                           `Filtros avançados ativos (${Array.isArray(filters) ? filters.length : 0} condições)`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setCurrentStep(2)} className="text-xs font-bold text-blue-500 hover:underline">Editar</button>
                  </div>

                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex gap-3 items-center">
                      <ArrowRight size={18} className="text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">O que vai acontecer</p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {actionType === 'MOVE' ? 'Mover' : actionType === 'COPY' ? 'Copiar' : actionType === 'ZIP' ? 'Compactar' : actionType === 'DELETE' ? 'Excluir' : 'Renomear'} 
                          {actionType !== 'DELETE' && actionType !== 'RENAME' && ` para ${folderMode === 'existente' ? targetDir : `${sourceDir}/${createPattern}`}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setCurrentStep(3)} className="text-xs font-bold text-blue-500 hover:underline">Editar</button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-r-2xl border-y border-r border-slate-200 dark:border-[#2a2e37]">
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    Quando encontrar <strong className="text-blue-700 dark:text-blue-400">{fileKind === 'ALL' ? 'qualquer arquivo' : fileKind !== 'CUSTOM' ? fileKind : 'arquivos filtrados'}</strong> em <span className="font-mono text-blue-700 dark:text-blue-400">{sourceDir}</span>, o Foldex Automate vai <strong className="text-blue-700 dark:text-blue-400">{actionType === 'MOVE' ? 'mover' : actionType === 'COPY' ? 'copiar' : actionType === 'ZIP' ? 'compactar' : actionType === 'DELETE' ? 'excluir' : 'renomear'}</strong> esses arquivos{actionType !== 'DELETE' && actionType !== 'RENAME' && ` para o destino configurado`}.
                  </p>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-3xl mx-auto space-y-6 pt-4">
                <div className="flex items-center gap-2 text-purple-500 mb-2">
                  <Sparkles size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Configuração de Automação</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Como você quer executar esta regra?</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Escolha entre execução automática (Sentinel vai monitorar a pasta continuamente) ou manual (você executa quando precisar).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  {/* Opção: Execução Manual */}
                  <div 
                    onClick={() => setEnableSentinel(false)}
                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${
                      !enableSentinel 
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500 shadow-lg' 
                        : 'bg-slate-50 dark:bg-[#13161b] border-slate-200 dark:border-[#2a2e37] hover:border-slate-300 dark:hover:border-[#383840]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        !enableSentinel 
                          ? 'border-blue-500 bg-blue-500' 
                          : 'border-slate-300 dark:border-[#2a2e37]'
                      }`}>
                        {!enableSentinel && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white">Execução Manual</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Você decide quando executar a regra. Clique em "Executar" na tela de regras sempre que precisar processar os arquivos.
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#2a2e37]">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Vantagens:</p>
                      <ul className="text-[10px] text-slate-600 dark:text-slate-400 space-y-1 mt-2">
                        <li>✓ Controle total do usuário</li>
                        <li>✓ Sem consumo de recursos</li>
                      </ul>
                    </div>
                  </div>

                  {/* Opção: Execução Automática (Sentinel) */}
                  <div 
                    onClick={() => setEnableSentinel(true)}
                    className={`p-6 rounded-2xl border-2 cursor-pointer transition-all relative ${
                      enableSentinel 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 shadow-lg' 
                        : 'bg-slate-50 dark:bg-[#13161b] border-slate-200 dark:border-[#2a2e37] hover:border-slate-300 dark:hover:border-[#383840]'
                    }`}
                  >
                    {!isCorePlan && (
                      <div className="absolute -top-2 -right-2 px-2 py-1 bg-amber-500 text-white text-[9px] font-bold rounded-full">
                        {isCorePlan ? 'Bloqueado' : 'Plano Pro+'}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        enableSentinel 
                          ? 'border-emerald-500 bg-emerald-500' 
                          : 'border-slate-300 dark:border-[#2a2e37]'
                      }`}>
                        {enableSentinel && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white">Automação com Sentinel</h3>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      O Sentinel monitora continuamente a pasta de origem. Quando novos arquivos aparecerem, a regra é executada automaticamente.
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-[#2a2e37]">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Vantagens:</p>
                      <ul className="text-[10px] text-slate-600 dark:text-slate-400 space-y-1 mt-2">
                        <li>✓ Automação 24/7</li>
                        <li>✓ Zero intervenção manual</li>
                        <li>✓ Processamento em tempo real</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 dark:bg-[#13161b]/50 rounded-2xl border border-slate-200 dark:border-[#2a2e37]">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    💡 <strong>Dica:</strong> Você pode mudar essa configuração a qualquer momento na tela "Minhas Regras" usando o botão de toggle.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* RODAPÉ DO WIZARD (NAVEGAÇÃO) */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-[#13161b] border-t border-slate-200 dark:border-[#2a2e37] shrink-0 flex items-center justify-between">
            <div className="flex flex-col">
              {formError && <span className="text-[10px] font-bold text-red-500 uppercase animate-pulse">{formError}</span>}
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              {currentStep > 0 && (
                <button 
                  onClick={() => {
                    setCurrentStep(currentStep - 1);
                    setFormError(null);
                  }}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#20242c] rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
              )}
              
              {currentStep < 5 ? (
                <button 
                  onClick={nextStep}
                  className="px-6 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                  style={{ backgroundColor: accentColor }}
                >
                  Continuar <ChevronRight size={16} />
                </button>
              ) : (
                <button 
                  onClick={handleSave}
                  className="px-8 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-transform active:scale-95 bg-emerald-600 hover:bg-emerald-700"
                >
                  Salvar regra <CheckCircle2 size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Painel Direito (Guia e Dicas - Oculto em telas menores) */}
        <div className="w-[280px] hidden lg:flex flex-col gap-6 shrink-0 pt-4">
          
          <div className="bg-slate-50 dark:bg-[#191c22] p-5 rounded-2xl border border-slate-200 dark:border-[#2a2e37] shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-[#243047] text-blue-600 dark:text-[#94b7fa] flex items-center justify-center mb-4">
              {currentStep === 0 && <Edit3 size={20} />}
              {currentStep === 1 && <Folder size={20} />}
              {currentStep === 2 && <Filter size={20} />}
              {currentStep === 3 && <ArrowRight size={20} />}
              {currentStep === 4 && <ShieldCheck size={20} />}
              {currentStep === 5 && <Sparkles size={20} />}
            </div>
            
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-2 leading-tight">
              {currentStep === 0 && "Um nome fácil de reconhecer"}
              {currentStep === 1 && "A origem é o ponto de entrada"}
              {currentStep === 2 && "Escolha só o necessário"}
              {currentStep === 3 && "Mover ou copiar?"}
              {currentStep === 4 && "Confira antes de concluir"}
              {currentStep === 5 && "Ativar automação?"}
            </h3>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {currentStep === 0 && "Pense na tarefa que você quer automatizar. Use uma ação e o tipo de arquivo."}
              {currentStep === 1 && "É a pasta em que você recebe ou guarda os arquivos antes da organização."}
              {currentStep === 2 && "O tipo de arquivo costuma ser suficiente. Os outros arquivos na pasta continuam como estão."}
              {currentStep === 3 && "Mover retira o arquivo da origem. Copiar mantém o original e cria uma cópia nova no destino."}
              {currentStep === 4 && "Leia o resumo como uma instrução. O Sentinel só vai executar as ações conforme as definições acima."}
            </p>

            <div className="mt-4 p-3 border-l-2 border-blue-500 bg-blue-50/50 dark:bg-[#1f2633] text-blue-800 dark:text-[#94b7fa] text-[10px] leading-relaxed font-medium rounded-r-lg">
              {currentStep === 0 && "“Separar PDFs” é mais fácil de identificar do que “Regra 01”."}
              {currentStep === 1 && "Se as NFe chegam em Downloads, essa será a origem."}
              {currentStep === 2 && "Precisa de algo específico? As opções avançadas permitem filtrar por nome e datas."}
              {currentStep === 3 && "Se estiver em dúvida, use “Copiar” para testar sem risco de perder arquivos."}
              {currentStep === 4 && "Nesta prévia, nenhuma automação é ativada até você ligar a regra no painel principal."}
            </div>
          </div>

          <div className="flex-1 bg-slate-50 dark:bg-[#191c22] p-5 rounded-2xl border border-slate-200 dark:border-[#2a2e37] shadow-sm">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-[#2a2e37] pb-2">Sua regra até aqui</h4>
            <div className="space-y-4">
              <div className="flex gap-2 items-start">
                <CheckCircle2 size={14} className={currentStep > 0 ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"} />
                <div>
                  <p className="text-[10px] font-bold text-slate-500">Nome</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{ruleName || '...'}</p>
                </div>
              </div>
              <div className="flex gap-2 items-start">
                <CheckCircle2 size={14} className={currentStep > 1 ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"} />
                <div>
                  <p className="text-[10px] font-bold text-slate-500">Origem</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-mono truncate max-w-[200px]">{sourceDir || '...'}</p>
                </div>
              </div>
              <div className="flex gap-2 items-start">
                <CheckCircle2 size={14} className={currentStep > 2 ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"} />
                <div>
                  <p className="text-[10px] font-bold text-slate-500">Filtro / Arquivos</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{fileKind === 'ALL' ? 'Todos os arquivos' : fileKind !== 'CUSTOM' && fileKind ? fileKind : Array.isArray(filters) && filters.length > 0 && String(filters[0]?.value || '').trim() ? 'Regras avançadas' : '...'}</p>
                </div>
              </div>
              <div className="flex gap-2 items-start">
                <CheckCircle2 size={14} className={currentStep > 3 ? "text-emerald-500" : "text-slate-300 dark:text-slate-600"} />
                <div>
                  <p className="text-[10px] font-bold text-slate-500">Ação e Destino</p>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {currentStep > 3 ? (actionType === 'MOVE' ? 'Mover' : actionType === 'COPY' ? 'Copiar' : actionType === 'ZIP' ? 'Compactar' : actionType === 'DELETE' ? 'Excluir' : 'Renomear') : '...'}
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-[9px] text-slate-500 mt-6 pt-4 border-t border-slate-200 dark:border-[#2a2e37] flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
              Nenhum arquivo é movido enquanto você configura.
            </p>
          </div>

        </div>
      </div>

      {/* 🌟 MODAL: MODELOS PRONTOS */}
      {isTemplatesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#191c22] w-full max-w-3xl rounded-3xl p-6 border border-slate-200 dark:border-[#2a2e37] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2a2e37] shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Comece com um modelo</h2>
                <p className="text-xs text-slate-500">Um ponto de partida inteligente para o seu nicho. Você ajusta os detalhes depois.</p>
              </div>
              <button onClick={() => setIsTemplatesModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-[#20242c] rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 overflow-y-auto custom-scrollbar pb-2 pr-2">
              {quickTemplates.map((tItem, idx) => {
                const Icon = tItem.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => applyTemplate(tItem)}
                    className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#2a2e37] hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-[#1c2433] transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-[#243047] text-blue-600 dark:text-[#94b7fa] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">{tItem.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{tItem.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: MINHAS REGRAS (ATIVAÇÃO/DESATIVAÇÃO) */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#191c22] w-full max-w-md h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl p-6 border-l sm:border border-slate-200 dark:border-[#2a2e37] shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2a2e37] shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Minhas Regras</h2>
                <p className="text-xs text-slate-500">Ligue, desligue ou edite as automações salvas.</p>
              </div>
              <button onClick={() => setIsRulesModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-[#20242c] rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 mb-4 relative shrink-0">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar regras..."
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-[#13161b] border border-slate-200 dark:border-[#343a45] rounded-xl text-slate-800 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
              {isLoading ? (
                <div className="h-40 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                  <RefreshCw size={24} className="animate-spin text-blue-500" />
                  <p>Carregando regras...</p>
                </div>
              ) : filteredAndSortedRules.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#20242c] text-slate-400 flex items-center justify-center mx-auto mb-4">
                    <ListOrdered size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Nenhuma regra encontrada</h3>
                  <p className="text-xs text-slate-500">Crie uma nova regra no assistente para vê-la aqui.</p>
                </div>
              ) : (
                filteredAndSortedRules.map((r) => (
                  <div key={r.id} className="p-4 bg-slate-50 dark:bg-[#13161b] rounded-xl border border-slate-200 dark:border-[#2a2e37] space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white line-clamp-1" title={r?.name}>{r?.name || 'Sem nome'}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-[#20242c] px-1.5 py-0.5 rounded">{r?.custom_code || 'AUTO'}</span>
                          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            {Array.isArray(r?.actions) ? r.actions[0]?.action_type || 'INDEFINIDA' : 'INDEFINIDA'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 bg-white dark:bg-[#191c22] p-1 rounded-lg border border-slate-200 dark:border-[#2a2e37]">
                        <button 
                          onClick={() => {
                            resetForm();
                            setEditingId(r.id || null);
                            setRuleName(r.name || '');
                            setCustomCode(r.custom_code || '');
                            setAutoCode(false);
                            setSourceDir(r.source_directory || '');
                            setFilters(Array.isArray(r.filters) ? r.filters : []);
                            
                            // Reconstruindo o Wizard a partir dos dados do Backend de forma segura
                            if (Array.isArray(r.actions) && r.actions.length > 0) {
                              const firstAction = r.actions[0];
                              setActionType(firstAction?.action_type || 'MOVE');
                              
                              const targetPattern = firstAction?.target_pattern || '';
                              const sourceDirFallback = r.source_directory || '';
                              
                              if (targetPattern.includes('{') || (sourceDirFallback && targetPattern.includes(sourceDirFallback))) {
                                setFolderMode('criar');
                                setSubfolderPreset('custom');
                                let pattern = targetPattern;
                                if (sourceDirFallback && pattern.startsWith(sourceDirFallback)) {
                                  pattern = pattern.replace(sourceDirFallback + '/', '');
                                }
                                setCreatePattern(pattern);
                              } else {
                                setFolderMode('existente');
                                setSubfolderPreset('fixed');
                                setTargetDir(targetPattern);
                              }
                              
                              setCleanAccents(firstAction?.clean_accents || false);
                              setReplaceSpaces(firstAction?.replace_spaces || false);
                              setCaseFormat(firstAction?.case_format || 'NONE');
                              setRegexPattern(firstAction?.regex_pattern || '');
                              setRegexReplacement(firstAction?.regex_replacement || '');
                              
                              if (firstAction?.regex_pattern) setRegexPreset('CUSTOM');
                              else setRegexPreset('NONE');
                            }
                            
                            // Define o FileKind baseado nos filtros de forma segura
                            const currentFilters = Array.isArray(r.filters) ? r.filters : [];
                            if (currentFilters.length === 1 && currentFilters[0]?.field_name === 'Tipo de Documento (Categoria)') {
                              setFileKind(currentFilters[0]?.value || '');
                            } else if (currentFilters.length === 1 && currentFilters[0]?.field_name === 'Extensão' && currentFilters[0]?.value === '') {
                              setFileKind('ALL');
                            } else {
                              setFileKind('CUSTOM');
                              setShowAdvancedConditions(true);
                            }

                            setIsRulesModalOpen(false);
                            setCurrentStep(0);
                            setFurthestStep(4); 
                          }}
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          title="Editar regra"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => { if(confirm("Deseja realmente excluir esta regra?")) invoke('delete_rule', { ruleId: r.id }).then(loadRules); }} 
                          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Excluir regra"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-[#2a2e37]">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
                          <Folder size={12} className="text-amber-500" />
                          <span className="truncate max-w-[120px]">{r?.source_directory || 'Nenhuma'}</span>
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleAutoPilot(r)}
                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
                          isCorePlan 
                            ? 'bg-slate-200/40 dark:bg-[#20242c] text-slate-400 cursor-not-allowed border border-slate-200 dark:border-[#343a45]' 
                            : r?.is_sentinel_active
                              ? 'bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-950/70'
                              : 'bg-slate-100 dark:bg-[#20242c] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-[#383840] hover:bg-slate-150 dark:hover:bg-[#27272a]'
                        }`}
                        title={isCorePlan ? "Disponível apenas no plano Foldex Pro" : r?.is_sentinel_active ? "Clique para desligar Sentinel (automação)" : "Clique para ligar Sentinel (automação)"}
                      >
                        {isCorePlan ? (
                          <>
                            <Lock size={12} />
                            <span>PRO</span>
                          </>
                        ) : (
                          <>
                            <div className={`w-2 h-2 rounded-full ${r?.is_sentinel_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{r?.is_sentinel_active ? 'Automático' : 'Manual'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 MODAL: UPSSELL E SMART ORGANIZE */}
      {upsellFeature && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#191c22] w-full max-w-sm rounded-3xl border border-slate-200 dark:border-[#2a2e37] shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-2.5 text-blue-500">
              {upsellFeature === 'AUTOPILOT' ? <Bot size={24} /> : <Layers size={24} />}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                  {upsellFeature === 'AUTOPILOT' ? 'Execução em 2º Plano' : 'Organização Inteligente'}
                </h3>
                <p className="text-[10px] text-blue-500/80 font-bold uppercase">Recurso Foldex Automate Pro</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-2">
              {upsellFeature === 'AUTOPILOT' 
                ? "A automação silenciosa (Sentinel) permite que o sistema monitore e mova seus arquivos automaticamente, sem que você precise clicar em nada."
                : "O Smart Organize varre pastas caóticas e categoriza todos os documentos, planilhas e mídias em subpastas organizadas com apenas 1 clique."
              }
              <br /><br />
              Faça o upgrade da sua licença para liberar este e outros recursos de produtividade corporativa.
            </p>

            <div className="flex flex-col gap-2 pt-4">
              <button 
                onClick={() => {
                  setUpsellFeature(null);
                  if (onNavigateToAccount) onNavigateToAccount();
                }} 
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm flex justify-center items-center gap-2"
              >
                <Lock size={14} /> Ativar Licença Corporativa
              </button>
              <button 
                onClick={() => setUpsellFeature(null)} 
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#20242c] text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-[#2a2e37] transition-colors"
              >
                Talvez mais tarde
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RuleBuilder;
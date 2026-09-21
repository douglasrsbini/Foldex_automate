import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { useBackup } from '../context/BackupContext'; // ⚡ Importando contexto global
import { 
  Database, Lock, Play, 
  CheckCircle2, FolderSearch, EyeOff, Eye, Cpu, Info,
  CloudUpload, Clock, X, Plus, Edit, Trash2, ArrowLeft, 
  Copy, Activity, AlertCircle, CheckSquare, Search, Download,
  ArrowUp, ArrowDown, ArrowUpDown, Loader2
} from 'lucide-react';

interface BackupViewProps {
  accentColor: string;
}

interface BackupTask {
  id?: number;
  task_name: string;
  source_type: string;
  connection_string?: string;
  source_path?: string;
  destination_dir: string;
  encrypt: boolean;
  password?: string;
  upload_offsite?: boolean;
  ftp_host?: string;
  ftp_user?: string;
  ftp_pass?: string;
  is_scheduled?: boolean;
  cron_schedule?: string;
  schedule_type?: string;
  schedule_day?: string;
}

interface BackupResult {
  success: boolean;
  message: string;
  file_path: string;
  size_bytes: number;
}

interface BackupLog {
  id: number;
  task_name: string;
  status: string;
  message: string;
  created_at: string;
}

type LogSortField = 'created_at' | 'task_name' | 'status';
type SortOrder = 'asc' | 'desc';

export const BackupView: React.FC<BackupViewProps> = ({ accentColor }) => {
  const [view, setView] = useState<'LIST' | 'FORM' | 'LOGS'>('LIST');
  const [tasks, setTasks] = useState<BackupTask[]>([]);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  
  // ⚡ Usando o Contexto Global para rastrear os IDs em execução
  const { executingIds, addExecuting, removeExecuting } = useBackup();
  
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);

  const [taskSearch, setTaskSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('ALL');
  const [logDateOperator, setLogStatusOperator] = useState('ALL'); 
  const [logDateStart, setLogDateStart] = useState('');
  const [logDateEnd, setLogDateEnd] = useState('');
  const [logDateSingle, setLogDateSingle] = useState('');

  const [sortField, setSortField] = useState<LogSortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [taskName, setTaskName] = useState('');
  const [sourceType, setSourceType] = useState('POSTGRES');
  const [connectionString, setConnectionString] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [destinationDir, setDestinationDir] = useState('');
  const [encrypt, setEncrypt] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [scheduleType, setScheduleType] = useState('WEEKLY');
  const [scheduleDay, setScheduleDay] = useState('5');
  const [uploadOffsite, setUploadOffsite] = useState(false);
  const [ftpHost, setFtpHost] = useState('');
  const [ftpUser, setFtpUser] = useState('');
  const [ftpPass, setFtpPass] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [lastResult, setLastResult] = useState<BackupResult | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const result = await invoke<BackupTask[]>('get_backup_tasks');
      setTasks(result);
      setSelectedTasks([]);
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
    }
  };

  const loadLogs = async () => {
    try {
      const result = await invoke<BackupLog[]>('get_backup_logs');
      setLogs(result);
      setView('LOGS');
    } catch (error) {
      alert("Erro ao carregar logs: " + error);
    }
  };

  const triggerNativeNotification = async (title: string, body: string) => {
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === 'granted';
      if (granted) sendNotification({ title, body });
    } catch (e) { console.error(e); }
  };

  const handleNewRoutine = () => {
    setCurrentTaskId(null); setTaskName(''); setSourceType('POSTGRES');
    setConnectionString(''); setSourcePath(''); setDestinationDir('');
    setEncrypt(true); setPassword(''); setIsScheduled(false);
    setScheduleType('WEEKLY'); setScheduleDay('5'); setUploadOffsite(false);
    setFtpHost(''); setFtpUser(''); setFtpPass('');
    setSelectedTasks([]); setView('FORM');
  };

  const handleEditRoutine = (task: BackupTask) => {
    setCurrentTaskId(task.id || null); setTaskName(task.task_name);
    setSourceType(task.source_type); setConnectionString(task.connection_string || '');
    setSourcePath(task.source_path || ''); setDestinationDir(task.destination_dir);
    setEncrypt(task.encrypt); setPassword(task.password || '');
    setIsScheduled(task.is_scheduled || false); setUploadOffsite(task.upload_offsite || false);
    setFtpHost(task.ftp_host || ''); setFtpUser(task.ftp_user || ''); setFtpPass(task.ftp_pass || '');
    
    if (task.schedule_type) setScheduleType(task.schedule_type);
    if (task.schedule_day) setScheduleDay(task.schedule_day);

    if (task.cron_schedule) {
      const parts = task.cron_schedule.split(' ');
      if (parts.length >= 5) setScheduleTime(`${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`);
    }
    setSelectedTasks([]); setView('FORM');
  };

  const handleDuplicateRoutine = async (task: BackupTask) => {
    const newTask = { ...task, id: undefined, task_name: `${task.task_name} (Cópia)` };
    try {
      await invoke('save_backup_task', { task: newTask });
      triggerNativeNotification("Sucesso", "Rotina duplicada com sucesso!");
      loadTasks();
    } catch (e) { alert("Erro ao duplicar rotina: " + e); }
  };

  const handleDeleteRoutine = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta rotina?")) {
      try {
        await invoke('delete_backup_task', { id });
        loadTasks();
      } catch (error) { alert("Erro ao excluir: " + error); }
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (!taskSearch) return true;
    const s = taskSearch.toLowerCase();
    return (
      task.task_name.toLowerCase().includes(s) ||
      task.destination_dir.toLowerCase().includes(s) ||
      (task.upload_offsite && 'nuvem ftp'.includes(s)) ||
      (task.is_scheduled && 'agendado automático'.includes(s))
    );
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedTasks(filteredTasks.map(t => t.id as number).filter(id => id !== undefined));
    else setSelectedTasks([]);
  };

  const handleSelectTask = (id: number) => {
    setSelectedTasks(prev => prev.includes(id) ? prev.filter(taskId => taskId !== id) : [...prev, id]);
  };

  const handleBulkExecute = async () => {
    if (!confirm(`Deseja executar as ${selectedTasks.length} rotinas selecionadas em paralelo?`)) return;
    
    const tasksToRun = tasks.filter(t => selectedTasks.includes(t.id as number));
    setSelectedTasks([]);

    // Dispara todas simultaneamente
    tasksToRun.forEach(task => {
      executeTask(task);
    });

    triggerNativeNotification("Lote Paralelo Iniciado", "As rotinas selecionadas estão processando simultaneamente.");
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Deseja remover as ${selectedTasks.length} rotinas selecionadas?`)) return;
    try {
      for (const id of selectedTasks) { await invoke('delete_backup_task', { id }); }
      setSelectedTasks([]); loadTasks();
    } catch (e) { alert("Erro ao remover lote: " + e); }
  };

  const handleSaveToDatabase = async () => {
    if (!taskName || !destinationDir) return alert("Preencha Nome e Destino Local.");
    
    setIsSaving(true);
    let cronExpr = '';
    
    if (isScheduled) {
      const [hour, minute] = scheduleTime.split(':');
      if (scheduleType === 'DAILY') cronExpr = `${minute} ${hour} * * *`;
      else if (scheduleType === 'WEEKLY') cronExpr = `${minute} ${hour} * * ${scheduleDay}`; 
      else if (scheduleType === 'MONTHLY') cronExpr = `${minute} ${hour} ${scheduleDay === 'LAST' ? 'L' : scheduleDay} * *`; 
    }

    const task: BackupTask = {
      id: currentTaskId || undefined, task_name: taskName, source_type: sourceType, connection_string: connectionString,
      source_path: sourcePath, destination_dir: destinationDir, encrypt, password: encrypt ? password : undefined,
      upload_offsite: uploadOffsite, ftp_host: uploadOffsite ? ftpHost : undefined,
      ftp_user: uploadOffsite ? ftpUser : undefined, ftp_pass: uploadOffsite ? ftpPass : undefined,
      is_scheduled: isScheduled, cron_schedule: isScheduled ? cronExpr : undefined,
      schedule_type: scheduleType, schedule_day: scheduleDay
    };

    try {
      await invoke('save_backup_task', { task });
      triggerNativeNotification("Sucesso", "Rotina salva com sucesso!");
      await loadTasks();
      setView('LIST');
    } catch (e) { alert("Erro ao salvar: " + e); }
    finally { setIsSaving(false); }
  };

  const executeTask = async (task: BackupTask) => {
    const taskId = task.id || 9999;
    if (executingIds.includes(taskId)) return;

    addExecuting(taskId);
    setLastResult(null);

    try {
      const result = await invoke<BackupResult>('execute_advanced_backup', { task });
      setLastResult(result);
      triggerNativeNotification("Backup Concluído", result.message);
    } catch (e) {
      triggerNativeNotification("Erro no Backup", String(e));
    } finally {
      removeExecuting(taskId);
    }
  };

  const selectSourceFolder = async () => {
    const selected = await open({ directory: true });
    if (selected) setSourcePath(selected as string);
  };
  const selectTargetFolder = async () => {
    const selected = await open({ directory: true });
    if (selected) setDestinationDir(selected as string);
  };

  const processedLogs = useMemo(() => {
    let result = logs.filter(log => {
      const s = logSearch.toLowerCase();
      const matchSearch = log.task_name.toLowerCase().includes(s) || 
                          log.message.toLowerCase().includes(s) ||
                          log.created_at.includes(s);
      const matchStatus = logStatusFilter === 'ALL' || log.status === logStatusFilter;
      return matchSearch && matchStatus;
    });

    if (logDateOperator !== 'ALL') {
      result = result.filter(log => {
        const logDate = log.created_at.split(' ')[0];
        if (logDateOperator === 'BETWEEN' && logDateStart && logDateEnd) return logDate >= logDateStart && logDate <= logDateEnd;
        if (logDateOperator === 'AFTER' && logDateSingle) return logDate > logDateSingle;
        if (logDateOperator === 'BEFORE' && logDateSingle) return logDate < logDateSingle;
        return true;
      });
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'created_at') comparison = a.created_at.localeCompare(b.created_at);
      else if (sortField === 'task_name') comparison = a.task_name.localeCompare(b.task_name);
      else if (sortField === 'status') comparison = a.status.localeCompare(b.status);
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [logs, logSearch, logStatusFilter, logDateOperator, logDateStart, logDateEnd, logDateSingle, sortField, sortOrder]);

  const handleSort = (field: LogSortField) => {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const renderSortIcon = (field: LogSortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1 opacity-40 group-hover:opacity-100" />;
    return sortOrder === 'asc' 
      ? <ArrowUp size={12} className="ml-1 text-blue-500 font-bold" /> 
      : <ArrowDown size={12} className="ml-1 text-blue-500 font-bold" />;
  };

  const exportLogsToCSV = () => {
    if (processedLogs.length === 0) return alert("Nenhum log para exportar.");
    const headers = ['Data e Hora', 'Rotina', 'Status', 'Log / Evento'];
    const csvContent = [
      headers.join(';'),
      ...processedLogs.map(log => {
        const date = log.created_at;
        const name = `"${log.task_name.replace(/"/g, '""')}"`;
        const status = log.status === 'SUCCESS' ? 'Sucesso' : 'Falha';
        const message = `"${log.message.replace(/"/g, '""')}"`;
        return `${date};${name};${status};${message}`;
      })
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `foldex_backup_logs_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full gap-2.5 overflow-hidden select-none max-w-6xl w-full mx-auto px-2">
      
      <div className="bg-white dark:bg-[#1e1e24] p-4 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Database size={18} style={{ color: accentColor }} />
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Backups e Cofres de Segurança</h2>
            <p className="text-[10px] text-slate-400">Orquestração, agendamentos e cópias de segurança em Nuvem/FTP.</p>
          </div>
        </div>
        
        {view === 'LIST' && (
          <div className="flex gap-2">
            <button onClick={loadLogs} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 dark:hover:bg-[#323238] text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 border border-slate-200 dark:border-[#383840] transition-colors">
              <Activity size={14} /> Logs de Backup
            </button>
            <button onClick={handleNewRoutine} className="px-3 py-1.5 rounded-xl text-white font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all" style={{ backgroundColor: accentColor }}>
              <Plus size={14} /> Nova Rotina
            </button>
          </div>
        )}
      </div>

      {view === 'LIST' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-1 pb-4">
          <div className="bg-white dark:bg-[#1e1e24] p-5 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs flex-1 flex flex-col relative">
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-[#2d2d34] min-h-[32px] flex-wrap gap-4">
              {selectedTasks.length > 0 ? (
                <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-blue-900/50">
                    <CheckSquare size={12} className="inline mr-1.5 mb-0.5" />
                    {selectedTasks.length} selecionada(s)
                  </span>
                  <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                  <button onClick={handleBulkExecute} className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center gap-1.5 transition-colors">
                    <Play size={13} /> Executar Lote Paralelo
                  </button>
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold flex items-center gap-1.5 transition-colors">
                    <Trash2 size={13} /> Excluir Lote
                  </button>
                  <button onClick={() => setSelectedTasks([])} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 dark:hover:bg-[#323238] text-slate-600 dark:text-slate-300 text-[10px] font-bold transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Gerenciador de Rotinas</span>
                  <div className="relative w-full max-w-xs ml-auto">
                    <Search size={13} className="absolute left-3 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar rotinas..."
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </>
              )}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50">
                <Database size={40} />
                <p className="text-xs font-semibold">{tasks.length > 0 ? "Nenhuma rotina encontrada na pesquisa." : "Nenhuma rotina cadastrada ainda."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d2d34]">
                      <th className="pb-3 pl-2 w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0} 
                          onChange={handleSelectAll}
                          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="pb-3 pl-1 w-[30%]">Nome da Rotina</th>
                      <th className="pb-3 w-[35%]">Destino Local</th>
                      <th className="pb-3 text-center w-16">Nuvem</th>
                      <th className="pb-3 text-center w-24">Agendamento</th>
                      <th className="pb-3 text-right pr-2 w-44">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => {
                      const isSelected = selectedTasks.includes(task.id as number);
                      const isCurrentlyExecuting = executingIds.includes(task.id as number);

                      return (
                        <tr key={task.id} className={`border-b border-slate-50 dark:border-[#2d2d34]/50 transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-[#25252b]'}`}>
                          <td className="py-4 pl-2">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => handleSelectTask(task.id as number)}
                              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-4 pl-1">
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                              {task.task_name}
                            </div>
                            
                            {/* ⚡ BARRA DE PROGRESSO EM CADA LINHA INDIVIDUAL */}
                            {isCurrentlyExecuting && (
                              <div className="mt-2 w-full max-w-[85%] animate-in fade-in duration-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider animate-pulse flex items-center gap-1">
                                    <Loader2 size={10} className="animate-spin" /> Processando Backup...
                                  </span>
                                </div>
                                <div className="w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-1.5 overflow-hidden relative">
                                  <div className="bg-blue-500 h-1.5 rounded-full w-[30%] animate-[progress_1.5s_ease-in-out_infinite]" />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-4 text-[10px] text-slate-500 font-mono truncate max-w-[240px] pr-4" title={task.destination_dir}>
                            {task.destination_dir}
                          </td>
                          <td className="py-4 text-center">
                            {task.upload_offsite ? <CloudUpload size={14} className="mx-auto text-blue-500" /> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="py-4 text-center">
                            {task.is_scheduled ? <Clock size={14} className="mx-auto text-emerald-500" /> : <span className="text-[10px] text-slate-400">Manual</span>}
                          </td>
                          <td className="py-4 pr-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => executeTask(task)} disabled={isCurrentlyExecuting} className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${isCurrentlyExecuting ? 'bg-indigo-600 text-white shadow-md cursor-not-allowed' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100'}`} title={isCurrentlyExecuting ? "Executando..." : "Executar Agora"}>
                                {isCurrentlyExecuting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                              </button>
                              <button onClick={() => handleDuplicateRoutine(task)} disabled={isCurrentlyExecuting} className="p-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50" title="Duplicar Rotina">
                                <Copy size={14} />
                              </button>
                              <button onClick={() => handleEditRoutine(task)} disabled={isCurrentlyExecuting} className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50" title="Editar">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDeleteRoutine(task.id!)} disabled={isCurrentlyExecuting} className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50" title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'LOGS' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-1 pb-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <button onClick={() => setView('LIST')} className="p-1.5 bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-[#2e2e34] rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                <ArrowLeft size={16} />
              </button>
              <span className="text-xs font-bold text-slate-500">Logs de Backup e Agendamentos</span>
            </div>
            
            <button onClick={exportLogsToCSV} className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 text-[10px] font-bold flex items-center gap-1.5 transition-colors">
              <Download size={13} /> Exportar Relatório (.CSV)
            </button>
          </div>

          <div className="bg-white dark:bg-[#1e1e24] p-5 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs flex-1 flex flex-col gap-4">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50/50 dark:bg-[#18181c]/50 p-4 rounded-xl border border-slate-100 dark:border-[#2c2c34]">
              <div className="relative md:col-span-5">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Filtro Geral</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar por rotina, evento..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                <select
                  value={logStatusFilter}
                  onChange={(e) => setLogStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white outline-none cursor-pointer font-semibold"
                >
                  <option value="ALL">Todos os Eventos</option>
                  <option value="SUCCESS">Apenas Sucesso</option>
                  <option value="ERROR">Apenas Falhas</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Filtro por Data de Execução</label>
                <select
                  value={logDateOperator}
                  onChange={(e) => setLogStatusOperator(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white outline-none cursor-pointer font-semibold"
                >
                  <option value="ALL">Todos os Períodos</option>
                  <option value="BETWEEN">Está entre (Período Fechado)</option>
                  <option value="AFTER">Depois de (Corte Posterior)</option>
                  <option value="BEFORE">Antes de (Corte Anterior)</option>
                </select>
              </div>

              {logDateOperator !== 'ALL' && (
                <div className="md:col-span-12 p-3 bg-white dark:bg-[#202024] border border-dashed border-slate-200 dark:border-[#383840] rounded-xl flex items-center gap-3 animate-in fade-in duration-200">
                  {logDateOperator === 'BETWEEN' ? (
                    <div className="flex items-center gap-2.5 w-full max-w-md">
                      <input 
                        type="date" 
                        value={logDateStart} 
                        onChange={e => setLogDateStart(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-[#18181b] border rounded-lg border-slate-200 dark:border-[#2e2e34] text-slate-800 dark:text-white outline-none dark:[color-scheme:dark]" 
                      />
                      <span className="text-[10px] font-extrabold text-slate-400">ATÉ</span>
                      <input 
                        type="date" 
                        value={logDateEnd} 
                        onChange={e => setLogDateEnd(e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-[#18181b] border rounded-lg border-slate-200 dark:border-[#2e2e34] text-slate-800 dark:text-white outline-none dark:[color-scheme:dark]" 
                      />
                    </div>
                  ) : (
                    <input 
                      type="date" 
                      value={logDateSingle} 
                      onChange={e => setLogDateSingle(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-[#18181b] border rounded-lg border-slate-200 dark:border-[#2e2e34] text-slate-800 dark:text-white outline-none dark:[color-scheme:dark] max-w-xs" 
                    />
                  )}
                </div>
              )}
            </div>

            {processedLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50 py-12">
                <Activity size={40} />
                <p className="text-xs font-semibold">Nenhum evento corresponde aos filtros aplicados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d2d34]">
                      <th onClick={() => handleSort('created_at')} className="pb-3 pl-2 w-40 cursor-pointer hover:text-blue-500 transition-colors group select-none">
                        <div className="flex items-center">Data e Hora {renderSortIcon('created_at')}</div>
                      </th>
                      <th onClick={() => handleSort('task_name')} className="pb-3 w-44 cursor-pointer hover:text-blue-500 transition-colors group select-none">
                        <div className="flex items-center">Rotina {renderSortIcon('task_name')}</div>
                      </th>
                      <th onClick={() => handleSort('status')} className="pb-3 w-28 cursor-pointer hover:text-blue-500 transition-colors group select-none">
                        <div className="flex items-center">Status {renderSortIcon('status')}</div>
                      </th>
                      <th className="pb-3">Log / Evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedLogs.map(log => (
                      <tr key={log.id} className="border-b border-slate-50 dark:border-[#2d2d34]/50 hover:bg-slate-50 dark:hover:bg-[#25252b] transition-colors">
                        <td className="py-3 pl-2 text-[10px] font-mono text-slate-500">{log.created_at}</td>
                        <td className="py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{log.task_name}</td>
                        <td className="py-3">
                          {log.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle2 size={10} /> Sucesso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <AlertCircle size={10} /> Falha
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[300px]" title={log.message}>
                          {log.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'FORM' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-1 pb-4 animate-in fade-in slide-in-from-right-4 duration-300">
          
          <div className="flex items-center gap-2 mb-1 max-w-5xl mx-auto w-full">
            <button onClick={() => { setView('LIST'); setSelectedTasks([]); }} className="p-1.5 bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-[#2e2e34] rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
              <ArrowLeft size={16} />
            </button>
            <span className="text-xs font-bold text-slate-500">{currentTaskId ? 'Editando Rotina' : 'Nova Rotina de Backup'}</span>
          </div>

          <div className="max-w-5xl mx-auto w-full flex flex-col gap-4">
              <div className="bg-white dark:bg-[#1e1e24] p-5 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-100 dark:border-[#2d2d34] pb-2">1. Escopo e Origem de Dados</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome da Rotina</label>
                    <input type="text" value={taskName} onChange={e => setTaskName(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white font-semibold outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo de Fonte de Dados</label>
                    <select value={sourceType} onChange={e => setSourceType(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white font-bold outline-none cursor-pointer">
                      <option value="POSTGRES">PostgreSQL (DUMP a quente)</option>
                      <option value="MYSQL">MySQL / MariaDB (DUMP a quente)</option>
                      <option value="FILES">Pastas, Servidores ou VMs</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    {sourceType === 'FILES' ? 'Pasta Corporativa de Origem' : 'String de Conexão do Banco'}
                  </label>
                  {sourceType === 'FILES' ? (
                    <div className="flex gap-2">
                      <input type="text" placeholder="Selecione o diretório..." value={sourcePath} onChange={e => setSourcePath(e.target.value)} className="flex-1 px-3 py-2 text-xs bg-slate-50 border rounded-xl outline-none dark:bg-[#18181b] dark:border-[#2e2e34] font-mono" />
                      <button onClick={selectSourceFolder} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#27272a] text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-[#383840] hover:bg-slate-200 transition-colors"><FolderSearch size={14} /> Buscar</button>
                    </div>
                  ) : (
                    <input type="text" placeholder="postgresql://usuario:senha@host:porta/banco" value={connectionString} onChange={e => setConnectionString(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl outline-none dark:bg-[#18181b] dark:border-[#2e2e34] font-mono" />
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-[#1e1e24] p-5 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs space-y-4">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-100 dark:border-[#2d2d34] pb-2">2. Destino Local e Segurança</span>
                 
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diretório do Cofre</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Onde o backup será salvo localmente..." value={destinationDir} onChange={e => setDestinationDir(e.target.value)} className="flex-1 px-3 py-2 text-xs bg-slate-50 border rounded-xl outline-none dark:bg-[#18181b] border-slate-200 dark:border-[#2e2e34] font-mono" />
                      <button onClick={selectTargetFolder} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#27272a] text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-[#383840] hover:bg-slate-200 transition-colors"><FolderSearch size={14} /> Buscar</button>
                    </div>
                 </div>
                 
                 <div className="p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e34]">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Lock size={15} className="text-emerald-500" /> Criptografia AES-256 (Padrão LGPD)</span>
                        <p className="text-[10px] text-slate-400 mt-0.5 ml-6 hidden sm:block">O arquivo .zip gerado será protegido com senha forte.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-[#333338] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                    {encrypt && (
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#2d2d34] relative">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Chave Mestra do Cofre</label>
                        <div className="relative">
                           <input type={showPassword ? "text" : "password"} placeholder="Digite a senha..." value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-3 pr-10 py-2 text-xs bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#383840] rounded-xl outline-none font-mono focus:ring-1 focus:ring-emerald-500 transition-shadow" />
                           <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400 hover:text-emerald-500 transition-colors">
                             {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                           </button>
                        </div>
                      </div>
                    )}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#1e1e24] p-5 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2d2d34] pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Clock size={13} className="text-blue-500" /> Agendamento Automático</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-[#333338] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>
                  {isScheduled ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-1 sm:col-span-2">
                         <label className="text-[9px] font-bold text-slate-400 uppercase">Frequência</label>
                         <select value={scheduleType} onChange={e => { setScheduleType(e.target.value); setScheduleDay(e.target.value === 'WEEKLY' ? '1' : 'LAST'); }} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 dark:border-[#2e2e34] rounded-xl font-bold dark:bg-[#18181b] outline-none">
                           <option value="DAILY">Diariamente</option>
                           <option value="WEEKLY">Semanalmente</option>
                           <option value="MONTHLY">Mensalmente</option>
                         </select>
                      </div>
                      
                      {scheduleType !== 'DAILY' && (
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-bold text-slate-400 uppercase">{scheduleType === 'WEEKLY' ? 'Dia da Semana' : 'Dia do Mês'}</label>
                           <select value={scheduleDay} onChange={e => setScheduleDay(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 dark:border-[#2e2e34] rounded-xl font-bold dark:bg-[#18181b] outline-none">
                              {scheduleType === 'WEEKLY' 
                                ? <><option value="0">Domingo</option><option value="1">Segunda</option><option value="2">Terça</option><option value="3">Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option><option value="6">Sábado</option></>
                                : <>{Array.from({length: 28}, (_, i) => i + 1).map(d => <option key={d} value={d}>Dia {d}</option>)}<option value="LAST">Último Dia</option></>
                              }
                           </select>
                        </div>
                      )}
                      <div className="space-y-1.5">
                         <label className="text-[9px] font-bold text-slate-400 uppercase">Horário</label>
                         <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 dark:border-[#2e2e34] rounded-xl font-mono font-bold dark:bg-[#18181b] dark:[color-scheme:dark] outline-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-slate-200 dark:border-[#2e2e34] rounded-xl text-center text-[10px] text-slate-400">
                       Ative o agendamento para rodar em background.
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-[#1e1e24] p-5 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs space-y-4">
                   <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2d2d34] pb-2">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><CloudUpload size={13} className="text-purple-500" /> Nuvem / FTP Offsite</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={uploadOffsite} onChange={(e) => setUploadOffsite(e.target.checked)} className="sr-only peer" />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-[#333338] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                   </div>
                   {uploadOffsite ? (
                     <div className="space-y-3 animate-in fade-in duration-200">
                       <div className="space-y-1.5">
                         <label className="text-[9px] font-bold text-slate-400 uppercase">Servidor (Host/IP)</label>
                         <input type="text" placeholder="ftp.dominio.com.br" value={ftpHost} onChange={e => setFtpHost(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 dark:border-[#2e2e34] rounded-xl dark:bg-[#18181b] font-mono outline-none" />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                           <label className="text-[9px] font-bold text-slate-400 uppercase">Usuário</label>
                           <input type="text" placeholder="user_backup" value={ftpUser} onChange={e => setFtpUser(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 dark:border-[#2e2e34] rounded-xl dark:bg-[#18181b] font-mono outline-none" />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-[9px] font-bold text-slate-400 uppercase">Senha</label>
                           <input type="password" placeholder="••••••••" value={ftpPass} onChange={e => setFtpPass(e.target.value)} className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 dark:border-[#2e2e34] rounded-xl dark:bg-[#18181b] font-mono outline-none" />
                         </div>
                       </div>
                     </div>
                   ) : (
                    <div className="p-4 border border-dashed border-slate-200 dark:border-[#2e2e34] rounded-xl text-center text-[10px] text-slate-400">
                       Ative a nuvem para gerar cópia externa (offsite).
                    </div>
                   )}
                </div>
              </div>
          </div>
        </div>
      )}

      {/* RODAPÉ GLOBAL E AVISOS */}
      <div className="bg-white dark:bg-[#1e1e24] p-4 rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-xs shrink-0 space-y-3">
        {lastResult && (
          <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-xl flex items-center justify-between animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 size={16} />
              <div className="text-xs">
                <p className="font-bold uppercase tracking-wider">{lastResult.message}</p>
                <p className="text-[10px] opacity-80 truncate max-w-md font-mono" title={lastResult.file_path}>Salvo em: {lastResult.file_path}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-green-800 dark:text-green-300 bg-green-200 dark:bg-green-900/60 px-2 py-1 rounded-lg">
                {lastResult.size_bytes < 1024 * 1024 ? `${(lastResult.size_bytes / 1024).toFixed(2)} KB` : `${(lastResult.size_bytes / (1024 * 1024)).toFixed(2)} MB`}
              </span>
              <button onClick={() => setLastResult(null)} className="text-green-700 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200 transition-colors p-1" title="Fechar">
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <Info size={13} className="text-blue-500 shrink-0" /> Salve no banco de dados para os agendamentos em background funcionarem de forma autônoma.
          </div>
          
          {view === 'FORM' && (
            <button 
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: accentColor }}
            >
              {isSaving ? <Cpu size={15} className="animate-pulse" /> : <Database size={15} />}
              <span>{isSaving ? 'Salvando...' : 'Salvar Rotina no Banco'}</span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default BackupView;
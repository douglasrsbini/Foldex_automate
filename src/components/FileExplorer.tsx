import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DriveInfo, FileItem, FileProperties } from '../types';
import { 
  Folder, File as FileIcon, HardDrive, ChevronRight, ArrowLeft, ArrowRight, ArrowUp,
  RefreshCw, Plus, Scissors, Copy, ClipboardPaste, Trash2, Edit3, FileArchive, Info, 
  Search, FolderInput, Star, LayoutGrid, LayoutList, ArrowUpDown, X, FileText, 
  FileSpreadsheet, FileImage, FileCode, FileAudio, FileVideo, Monitor, Download, 
  Image as ImageIcon, Clock, ChevronDown, CheckSquare, Square, AlertTriangle,
  Lock, Eye, EyeOff
} from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ⚡ Óculos Mágicos Injetados!

interface FileExplorerProps {
  onSetSource?: (path: string) => void;
  accentColor: string;
}

interface FavoriteItem { name: string; path: string; }
interface RecentOrFrequentFolder { name: string; path: string; count?: number; }
type ViewMode = 'list' | 'grid';
type SortField = 'name' | 'size' | 'type' | 'date';
type SortDirection = 'asc' | 'desc';

interface ContextMenuState { visible: boolean; x: number; y: number; targetItem: FileItem | null; }

const ROW_HEIGHT = 40;       
const GRID_ITEM_HEIGHT = 110; 
const OVERSCAN = 10;         

export const FileExplorer: React.FC<FileExplorerProps> = ({ onSetSource, accentColor }) => {
  const { t } = useTranslation(); 

  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [userHomePath, setUserHomePath] = useState<string>('');
  
  const [currentPath, setCurrentPath] = useState<string>('');
  
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [futureHistory, setFutureHistory] = useState<string[]>([]);
  const [items, setItems] = useState<FileItem[]>([]);
  
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('explorer_sidebar_width');
    return saved ? parseInt(saved, 10) : 240;
  });
  const isSidebarResizingRef = useRef(false);

  const [colWidths, setColWidths] = useState({ name: 380, size: 110, type: 100, date: 180 });
  const resizingColRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem('explorer_view_mode') as ViewMode) || 'list');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    const saved = localStorage.getItem('explorer_favorites');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
    return [];
  });

  const [recentPaths, setRecentPaths] = useState<RecentOrFrequentFolder[]>(() => {
    const saved = localStorage.getItem('explorer_recent_paths');
    if (saved) { try { return JSON.parse(saved); } catch { /* ignore */ } }
    return [];
  });

  const [clipboard, setClipboard] = useState<{ paths: string[]; isCut: boolean } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, targetItem: null });
  const [showNewDropdown, setShowNewDropdown] = useState<boolean>(false);

  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileDefaultExt, setNewFileDefaultExt] = useState<string>('');

  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState<string>('');
  
  const [propertiesModal, setPropertiesModal] = useState<FileProperties | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const [showZipModal, setShowZipModal] = useState<boolean>(false);
  const [zipFileName, setZipFileName] = useState<string>('');
  const [zipEncrypt, setZipEncrypt] = useState<boolean>(false);
  const [zipPassword, setZipPassword] = useState<string>('');
  const [showZipPassword, setShowZipPassword] = useState<boolean>(false);

  const [isEditingPath, setIsEditingPath] = useState<boolean>(false);
  const [inputPathValue, setInputPathValue] = useState<string>('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollInfo, setScrollInfo] = useState({ top: 0, height: 800, width: 800 });

  // ⚡ INTERCEPTADORES DE TRADUÇÃO DE UI (MAQUIAGEM)
  const translateDriveName = (name: string) => {
    // Intercepta "Disco Local", "Local Disk" e troca pela tradução do idioma atual preservando a letra (C:)
    return name.replace(/^(Disco Local|Local Disk|Disque Local|Disco local)\s*/i, `${t('explorer.local_disk')} `);
  };

  const translateSystemFolderName = (name: string) => {
    // Intercepta pastas raiz do Windows nas sessões "Recentes" e "Favoritos"
    const lowerName = name.toLowerCase();
    if (lowerName === 'área de trabalho' || lowerName === 'desktop') return t('explorer.quick_desktop');
    if (lowerName === 'downloads') return t('explorer.quick_downloads');
    if (lowerName === 'documentos' || lowerName === 'documents') return t('explorer.quick_documents');
    if (lowerName === 'imagens' || lowerName === 'pictures') return t('explorer.quick_pictures');
    return name; // Se não for sistema, mantém o nome real da pasta
  };

  useEffect(() => { 
    const initializeExplorer = async () => {
      try {
        const driveList = await invoke<DriveInfo[]>('list_drives');
        setDrives(driveList || []);
        
        const uPath = await invoke<string>('get_default_user_path');
        if (uPath) setUserHomePath(uPath);

        const savedPath = sessionStorage.getItem('explorer_last_path');
        
        if (savedPath) {
          navigateTo(savedPath, false);
        } else {
          const driveC = driveList?.find(d => d.path.toUpperCase().startsWith('C:'));
          if (driveC) {
            navigateTo(driveC.path, false);
          } else if (uPath) {
            navigateTo(uPath, false);
          } else if (driveList && driveList.length > 0) {
            navigateTo(driveList[0].path, false);
          }
        }
      } catch (e) {
        console.error('Erro na inicialização do explorador:', e);
      }
    };

    initializeExplorer(); 
  }, []);

  useEffect(() => { localStorage.setItem('explorer_view_mode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('explorer_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('explorer_recent_paths', JSON.stringify(recentPaths)); }, [recentPaths]);
  useEffect(() => { localStorage.setItem('explorer_sidebar_width', sidebarWidth.toString()); }, [sidebarWidth]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    
    let timeoutId: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setScrollInfo(prev => {
          const widthChanged = Math.abs(prev.width - width) > 25;
          const heightChanged = Math.abs(prev.height - height) > 25;
          if (!widthChanged && !heightChanged) return prev;
          return { ...prev, height, width };
        });
      }, 100);
    });
    observer.observe(el);
    return () => { observer.disconnect(); clearTimeout(timeoutId); };
  }, [viewMode]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    requestAnimationFrame(() => setScrollInfo(prev => prev.top === top ? prev : { ...prev, top }));
  };

  const startSidebarResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isSidebarResizingRef.current = true;
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isSidebarResizingRef.current) return;
      const newWidth = moveEvent.clientX - 16; 
      if (newWidth >= 200 && newWidth <= 420) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      isSidebarResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const startColResizing = (field: keyof typeof colWidths, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = { field, startX: e.clientX, startWidth: colWidths[field] };
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const { field, startX, startWidth } = resizingColRef.current;
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(70, startWidth + diff);
      setColWidths(prev => ({ ...prev, [field]: newWidth }));
    };
    const handleMouseUp = () => {
      resizingColRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const resetColWidth = (field: keyof typeof colWidths) => {
    const defaults = { name: 380, size: 110, type: 100, date: 180 };
    setColWidths(prev => ({ ...prev, [field]: defaults[field] }));
  };

  useEffect(() => {
    const handleGlobalInteraction = (e: MouseEvent) => {
      const target = e.target as Node;
      const menuEl = document.getElementById('custom-context-menu');
      const dropEl = document.getElementById('custom-new-dropdown');
      const newBtn = document.getElementById('btn-novo-dropdown');

      if (menuEl && !menuEl.contains(target)) {
        setContextMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
      }
      if (dropEl && !dropEl.contains(target) && newBtn && !newBtn.contains(target)) {
        setShowNewDropdown(false);
      }
    };

    window.addEventListener('mousedown', handleGlobalInteraction, true);
    window.addEventListener('contextmenu', handleGlobalInteraction, true);
    
    return () => {
      window.removeEventListener('mousedown', handleGlobalInteraction, true);
      window.removeEventListener('contextmenu', handleGlobalInteraction, true);
    };
  }, []);

  const registerFolderAccess = (path: string) => {
    if (!path) return;
    const folderName = path.split(/[\/\\]/).filter(Boolean).pop() || path;
    if (folderName.length === 2 && folderName.endsWith(':')) return; 

    setRecentPaths(prev => {
      const filtered = prev.filter(p => p.path.toLowerCase() !== path.toLowerCase());
      return [{ name: folderName, path }, ...filtered].slice(0, 5);
    });
  };

  const navigateTo = async (newPath: string, saveHistory = true) => {
    if (!newPath) return;
    setLoading(true);
    try {
      const contents = await invoke<FileItem[]>('list_directory_contents', { path: newPath });
      setItems(contents || []);
      if (saveHistory && currentPath && currentPath !== newPath) {
        setPathHistory(prev => [...prev, currentPath]);
        setFutureHistory([]);
      }
      setCurrentPath(newPath);
      
      sessionStorage.setItem('explorer_last_path', newPath);

      setInputPathValue(newPath);
      setIsEditingPath(false);
      setSelectedPaths([]);
      setLastSelectedIndex(null);
      setSearchFilter('');
      registerFolderAccess(newPath);
      
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
        setScrollInfo(prev => ({ ...prev, top: 0 }));
      }
    } catch (e) {
      alert(`${t('explorer.alert_dir_error')} ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    if (pathHistory.length === 0) return;
    const previous = pathHistory[pathHistory.length - 1];
    setPathHistory(prev => prev.slice(0, -1));
    setFutureHistory(prev => [currentPath, ...prev]);
    navigateTo(previous, false);
  };

  const handleGoForward = () => {
    if (futureHistory.length === 0) return;
    const next = futureHistory[0];
    setFutureHistory(prev => prev.slice(1));
    setPathHistory(prev => [...prev, currentPath]);
    navigateTo(next, false);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const normalized = currentPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    let parent = parts.join('\\');
    if (/^[a-zA-Z]:$/.test(parent)) parent += '\\';
    navigateTo(parent);
  };

  const handleItemClick = (item: FileItem, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setContextMenu(prev => prev.visible ? { ...prev, visible: false } : prev);
    setShowNewDropdown(false);

    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths(prev => prev.includes(item.path) ? prev.filter(p => p !== item.path) : [...prev, item.path]);
      setLastSelectedIndex(index);
    } else if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangePaths = filteredAndSortedItems.slice(start, end + 1).map(i => i.path);
      setSelectedPaths(Array.from(new Set([...selectedPaths, ...rangePaths])));
    } else {
      setSelectedPaths([item.path]);
      setLastSelectedIndex(index);
    }
  };

  const handleCheckboxChange = (item: FileItem, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) setSelectedPaths(prev => [...prev, item.path]);
    else setSelectedPaths(prev => prev.filter(p => p !== item.path));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedPaths(filteredAndSortedItems.map(i => i.path));
    else setSelectedPaths([]);
  };

  const handleItemDoubleClick = async (item: FileItem) => {
    if (item.is_dir) {
      navigateTo(item.path);
    } else {
      try {
        await invoke('open_item_natively', { path: item.path });
      } catch (err) {
        console.error("Erro ao tentar abrir arquivo nativamente:", err);
        handleInspectProperties(item.path); 
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (item && !selectedPaths.includes(item.path)) {
      setSelectedPaths([item.path]);
    }
    
    const x = Math.max(0, Math.min(e.clientX, window.innerWidth - 240));
    const y = Math.max(0, Math.min(e.clientY, window.innerHeight - 380));
    
    setTimeout(() => {
      setContextMenu({ visible: true, x, y, targetItem: item });
    }, 0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedPaths(filteredAndSortedItems.map(i => i.path));
      } else if (e.key === 'Escape') {
        setSelectedPaths([]);
        setContextMenu(prev => ({ ...prev, visible: false }));
        setShowNewDropdown(false);
      } else if (e.key === 'Delete' && selectedPaths.length > 0) {
        e.preventDefault();
        setShowDeleteModal(true); 
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedPaths.length > 0) {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedPaths.length > 0) {
        e.preventDefault();
        handleCut();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboard) {
        e.preventDefault();
        handlePaste();
      } else if (e.key === 'F2' && selectedPaths.length === 1) {
        e.preventDefault();
        const target = items.find(i => i.path === selectedPaths[0]);
        if (target) openRenameModal(target);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPaths, clipboard, items]);

  const openNewFileModal = (ext: string) => {
    setShowNewDropdown(false);
    setNewFileDefaultExt(ext);
    setNewFileName('');
    setShowNewFileModal(true);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await invoke('create_folder', { parentDir: currentPath, folderName: newFolderName.trim() });
      setShowNewFolderModal(false);
      setNewFolderName('');
      navigateTo(currentPath, false);
    } catch (e) { alert(`${t('explorer.alert_create_folder')} ${e}`); }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    let finalName = newFileName.trim();
    if (newFileDefaultExt && !finalName.toLowerCase().endsWith(newFileDefaultExt.toLowerCase())) {
      finalName = `${finalName}${newFileDefaultExt}`;
    }
    try {
      await invoke('create_empty_file', { parentDir: currentPath, fileName: finalName });
      setShowNewFileModal(false);
      setNewFileName('');
      setNewFileDefaultExt('');
      navigateTo(currentPath, false);
    } catch (e) { alert(`${t('explorer.alert_create_file')} ${e}`); }
  };

  const openRenameModal = (item: FileItem) => {
    setRenameTarget(item);
    setNewName(item.name);
    setShowRenameModal(true);
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      await invoke('rename_item', { path: renameTarget.path, newName: newName.trim() });
      setShowRenameModal(false);
      setRenameTarget(null);
      setNewName('');
      navigateTo(currentPath, false);
    } catch (e) { alert(`${t('explorer.alert_rename')} ${e}`); }
  };

  const executeDelete = async () => {
    try {
      for (const p of selectedPaths) { 
        await invoke('delete_item', { path: p }); 
      }
      setSelectedPaths([]);
      setShowDeleteModal(false);
      navigateTo(currentPath, false);
    } catch (e) { 
      alert(`${t('explorer.alert_delete')} ${e}`); 
      setShowDeleteModal(false);
    }
  };

  const handleCopy = () => { if (selectedPaths.length > 0) setClipboard({ paths: [...selectedPaths], isCut: false }); };
  const handleCut = () => { if (selectedPaths.length > 0) setClipboard({ paths: [...selectedPaths], isCut: true }); };

  const handlePaste = async () => {
    if (!clipboard || clipboard.paths.length === 0) return;
    try {
      for (const p of clipboard.paths) { await invoke('paste_item', { srcPath: p, destDir: currentPath, cut: clipboard.isCut }); }
      if (clipboard.isCut) setClipboard(null);
      navigateTo(currentPath, false);
    } catch (e) { alert(`${t('explorer.alert_paste')} ${e}`); }
  };

  const handleCompressZip = () => {
    if (selectedPaths.length === 0) return;
    
    let defaultName = `Arquivos_Compactados_${Date.now()}.zip`;
    if (selectedPaths.length === 1) {
      const item = items.find(i => i.path === selectedPaths[0]);
      if (item) {
        const baseName = item.is_dir ? item.name : (item.name.includes('.') ? item.name.substring(0, item.name.lastIndexOf('.')) : item.name);
        defaultName = `${baseName}.zip`;
        const alreadyExists = items.some(i => i.name.toLowerCase() === defaultName.toLowerCase());
        if (alreadyExists) defaultName = `${baseName}_${Date.now()}.zip`;
      }
    }
    
    setZipFileName(defaultName);
    setZipEncrypt(false);
    setZipPassword('');
    setShowZipPassword(false);
    setShowZipModal(true);
  };

  const executeCompressZip = async () => {
    if (!zipFileName.trim()) return alert(t('explorer.alert_zip_empty'));
    if (zipEncrypt && !zipPassword.trim()) return alert(t('explorer.alert_zip_pass'));

    let finalZipName = zipFileName.trim();
    if (!finalZipName.toLowerCase().endsWith('.zip')) {
       finalZipName += '.zip';
    }

    const separator = currentPath.includes('\\') ? '\\' : '/';
    const destZip = currentPath.endsWith(separator) ? `${currentPath}${finalZipName}` : `${currentPath}${separator}${finalZipName}`;
    
    try {
      await invoke('compress_items_to_zip', { 
        sourcePaths: selectedPaths, 
        destZip, 
        password: zipEncrypt ? zipPassword : null 
      });
      
      setShowZipModal(false);
      alert(zipEncrypt 
        ? `${t('explorer.alert_zip_success_1')} "${finalZipName}" ${t('explorer.alert_zip_success_2')}` 
        : `${t('explorer.alert_zip_success_3')} "${finalZipName}" ${t('explorer.alert_zip_success_4')}`
      );
      navigateTo(currentPath, false);
    } catch (e) { 
      alert(`${t('explorer.alert_zip_fail')} ${e}`); 
    }
  };

  const handleInspectProperties = async (path: string) => {
    try {
      const res = await invoke<FileProperties>('get_file_properties', { path });
      setPropertiesModal(res);
    } catch (e) { alert(`${t('explorer.alert_props')} ${e}`); }
  };

  const isPathFavorite = (path: string) => favorites.some(f => f.path === path);

  const toggleFavorite = (item: FileItem) => {
    if (isPathFavorite(item.path)) setFavorites(prev => prev.filter(f => f.path !== item.path));
    else setFavorites(prev => [...prev, { name: item.name, path: item.path }]);
  };

  const toggleCurrentAsFavorite = () => {
    if (!currentPath) return;
    if (isPathFavorite(currentPath)) setFavorites(prev => prev.filter(f => f.path !== currentPath));
    else {
      const name = currentPath.split(/[\/\\]/).filter(Boolean).pop() || currentPath;
      setFavorites(prev => [...prev, { name, path: currentPath }]);
    }
  };

  const systemQuickAccess = useMemo(() => {
    if (!userHomePath) return [];
    const sep = userHomePath.includes('\\') ? '\\' : '/';
    return [
      { name: t('explorer.quick_desktop'), path: `${userHomePath}${sep}Desktop`, icon: Monitor },
      { name: t('explorer.quick_downloads'), path: `${userHomePath}${sep}Downloads`, icon: Download },
      { name: t('explorer.quick_documents'), path: `${userHomePath}${sep}Documents`, icon: FileText },
      { name: t('explorer.quick_pictures'), path: `${userHomePath}${sep}Pictures`, icon: ImageIcon },
    ];
  }, [userHomePath, t]);

  const getFileCategoryIcon = (item: FileItem) => {
    if (item.is_dir) return <Folder size={18} className="text-amber-500 shrink-0" />;
    const ext = (item.extension || '').toLowerCase();
    if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return <FileText size={18} className="text-blue-500 shrink-0" />;
    if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) return <FileSpreadsheet size={18} className="text-emerald-500 shrink-0" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return <FileImage size={18} className="text-purple-500 shrink-0" />;
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return <FileAudio size={18} className="text-pink-500 shrink-0" />;
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return <FileVideo size={18} className="text-rose-500 shrink-0" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive size={18} className="text-amber-600 shrink-0" />;
    if (['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'json', 'html', 'css', 'sql'].includes(ext)) return <FileCode size={18} className="text-cyan-500 shrink-0" />;
    return <FileIcon size={18} className="text-slate-400 shrink-0" />;
  };

  const breadcrumbSegments = useMemo(() => {
    if (!currentPath) return [];
    const normalized = currentPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    return parts.map((part, index) => {
      let full = parts.slice(0, index + 1).join('\\');
      if (/^[a-zA-Z]:$/.test(full)) full += '\\';
      return { name: part, path: full };
    });
  }, [currentPath]);

  const filteredAndSortedItems = useMemo(() => {
    let list = items.filter(i => (i.name || '').toLowerCase().includes(searchFilter.toLowerCase()));
    list.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      else if (sortField === 'size') cmp = (a.size_bytes || 0) - (b.size_bytes || 0);
      else if (sortField === 'type') cmp = (a.extension || '').localeCompare(b.extension || '');
      else if (sortField === 'date') cmp = (a.last_modified || '').localeCompare(b.last_modified || '');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [items, searchFilter, sortField, sortDirection]);

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const isAllSelected = filteredAndSortedItems.length > 0 && selectedPaths.length === filteredAndSortedItems.length;

  const totalItems = filteredAndSortedItems.length;
  const startRow = Math.max(0, Math.floor(scrollInfo.top / ROW_HEIGHT) - OVERSCAN);
  const endRow = Math.min(totalItems - 1, Math.ceil((scrollInfo.top + scrollInfo.height) / ROW_HEIGHT) + OVERSCAN);
  const visibleListItems = filteredAndSortedItems.slice(startRow, endRow + 1);

  const cols = scrollInfo.width >= 1024 ? 6 : scrollInfo.width >= 768 ? 4 : scrollInfo.width >= 640 ? 3 : 2;
  const totalGridRows = Math.ceil(totalItems / cols);
  const startGridRow = Math.max(0, Math.floor(scrollInfo.top / GRID_ITEM_HEIGHT) - 4);
  const endGridRow = Math.min(totalGridRows - 1, Math.ceil((scrollInfo.top + scrollInfo.height) / GRID_ITEM_HEIGHT) + 4);
  const visibleGridItems = filteredAndSortedItems.slice(startGridRow * cols, (endGridRow + 1) * cols);

  return (
    <div onContextMenu={(e) => handleContextMenu(e, null)} onClick={() => setSelectedPaths([])} className="flex h-full w-full gap-3 overflow-hidden select-none relative">
      
      {/* 🧭 BARRA LATERAL ESQUERDA */}
      <div style={{ width: `${sidebarWidth}px` }} onClick={(e) => e.stopPropagation()} className="shrink-0 bg-white dark:bg-[#1e1e24] p-3 rounded-2xl border border-slate-200 dark:border-[#2e2e34] flex flex-col justify-between shadow-sm overflow-y-auto overflow-x-hidden custom-scrollbar relative">
        <div className="space-y-3.5 pb-2">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">{t('explorer.drives_title')}</span>
            <div className="space-y-0.5">
              {drives.map((d) => {
                const isActive = currentPath.toLowerCase() === d.path.toLowerCase();
                const displayName = translateDriveName(d.name);
                return (
                  <button key={d.path} onClick={() => navigateTo(d.path)} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272a]'}`}>
                    <HardDrive size={14} className="shrink-0 text-blue-500" /><span className="truncate">{displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {systemQuickAccess.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-[#2e2e34]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">{t('explorer.quick_access')}</span>
              <div className="space-y-0.5">
                {systemQuickAccess.map((link) => {
                  const isActive = currentPath.toLowerCase() === link.path.toLowerCase();
                  const Icon = link.icon;
                  return (
                    <button key={link.path} onClick={() => navigateTo(link.path)} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272a]'}`}>
                      <Icon size={14} className="shrink-0 text-blue-500" /><span className="truncate">{link.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {recentPaths.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-[#2e2e34]">
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <Clock size={12} className="text-purple-500" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t('explorer.recent')}</span>
              </div>
              <div className="space-y-0.5">
                {recentPaths.map((rec) => {
                  const isActive = currentPath.toLowerCase() === rec.path.toLowerCase();
                  const displayName = translateSystemFolderName(rec.name);
                  return (
                    <button key={rec.path} onClick={() => navigateTo(rec.path)} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272a]'}`} title={rec.path}>
                      <Folder size={13} className="text-purple-500 shrink-0" /><span className="truncate">{displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-[#2e2e34]">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex-1 truncate">{t('explorer.pinned')}</span>
              <button onClick={toggleCurrentAsFavorite} className="text-slate-400 hover:text-amber-500 transition-colors p-0.5" title={isPathFavorite(currentPath) ? t('explorer.unpin_tooltip') : t('explorer.pin_tooltip')}>
                {isPathFavorite(currentPath) ? <Star size={13} className="fill-amber-400 text-amber-400" /> : <Star size={13} />}
              </button>
            </div>
            <div className="space-y-0.5">
              {favorites.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic px-1">{t('explorer.empty_pinned')}</p>
              ) : (
                favorites.map((fav) => {
                  const isActive = currentPath.toLowerCase() === fav.path.toLowerCase();
                  const displayName = translateSystemFolderName(fav.name);
                  return (
                    <div key={fav.path} className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#27272a]'}`}>
                      <button onClick={() => navigateTo(fav.path)} className="flex items-center gap-2 truncate flex-1 text-left"><Folder size={13} className="text-amber-500 shrink-0" /><span className="truncate">{displayName}</span></button>
                      <button onClick={(e) => { e.stopPropagation(); setFavorites(prev => prev.filter(f => f.path !== fav.path)); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5" title={t('explorer.unpin_tooltip')}><X size={12} /></button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {onSetSource && currentPath && (
          <button onClick={() => onSetSource(currentPath)} className="w-full py-2 px-2.5 rounded-xl text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 shrink-0 mt-2" style={{ backgroundColor: accentColor }} title={t('explorer.use_as_source')}>
            <FolderInput size={14} /><span className="truncate">{t('explorer.use_as_source')}</span>
          </button>
        )}

        <div onMouseDown={startSidebarResizing} className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500 transition-colors z-10" />
      </div>

      {/* 📁 PAINEL PRINCIPAL DO EXPLORADOR */}
      <div onClick={(e) => e.stopPropagation()} className="flex-1 bg-white dark:bg-[#1e1e24] p-4 rounded-2xl border border-slate-200 dark:border-[#2e2e34] flex flex-col space-y-3 shadow-sm min-w-0">
        
        {/* BARRA SUPERIOR: Navegação & Busca */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100 dark:border-[#2e2e34]">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={handleGoBack} disabled={pathHistory.length === 0} className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#27272a] disabled:opacity-30 transition-colors"><ArrowLeft size={16} /></button>
              <button onClick={handleGoForward} disabled={futureHistory.length === 0} className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#27272a] disabled:opacity-30 transition-colors"><ArrowRight size={16} /></button>
              <button onClick={handleGoUp} className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#27272a] transition-colors"><ArrowUp size={16} /></button>
              <button onClick={() => navigateTo(currentPath, false)} className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-[#27272a] transition-colors"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
            </div>

            <div className="flex-1 min-w-0 px-2 py-1 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl flex items-center overflow-x-auto text-xs font-medium">
              {isEditingPath ? (
                <input type="text" value={inputPathValue} onChange={(e) => setInputPathValue(e.target.value)} onBlur={() => { setIsEditingPath(false); if (inputPathValue.trim()) navigateTo(inputPathValue.trim()); }} onKeyDown={(e) => { if (e.key === 'Enter') { setIsEditingPath(false); if (inputPathValue.trim()) navigateTo(inputPathValue.trim()); } else if (e.key === 'Escape') { setIsEditingPath(false); setInputPathValue(currentPath); } }} autoFocus className="w-full bg-transparent font-mono outline-none text-slate-800 dark:text-white" />
              ) : (
                <div onClick={() => setIsEditingPath(true)} className="flex items-center gap-1 w-full cursor-text overflow-x-auto py-0.5">
                  {breadcrumbSegments.map((seg, idx) => (
                    <React.Fragment key={seg.path}>
                      <button onClick={(e) => { e.stopPropagation(); navigateTo(seg.path); }} className="px-1.5 py-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-[#2e2e34] text-slate-700 dark:text-slate-300 font-semibold truncate shrink-0 transition-colors">{seg.name}</button>
                      {idx < breadcrumbSegments.length - 1 && <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="relative w-48 shrink-0">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input type="text" placeholder={t('explorer.search_ph')} value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#2e2e34] rounded-xl text-slate-800 dark:text-white outline-none" />
          </div>
        </div>

        {/* BARRA DE AÇÕES */}
        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap relative">
            <div className="relative">
              <button id="btn-novo-dropdown" onClick={(e) => { e.stopPropagation(); setShowNewDropdown(prev => !prev); }} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#27272a] hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5 border border-slate-200 dark:border-[#383840] transition-colors">
                <Plus size={14} /> {t('explorer.btn_new')} <ChevronDown size={12} />
              </button>

              {showNewDropdown && (
                <div id="custom-new-dropdown" onClick={(e) => e.stopPropagation()} className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-[#202024] rounded-2xl border border-slate-200 dark:border-[#333338] shadow-xl p-1.5 z-30 space-y-0.5 text-xs">
                  <button onClick={() => { setShowNewDropdown(false); setShowNewFolderModal(true); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] text-left font-semibold text-slate-700 dark:text-slate-200"><Folder size={14} className="text-amber-500" /><span>{t('explorer.new_folder')}</span></button>
                  <div className="h-[1px] bg-slate-100 dark:bg-[#2e2e34] my-1" />
                  <button onClick={() => openNewFileModal('.txt')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] text-left font-semibold text-slate-700 dark:text-slate-200"><FileText size={14} className="text-blue-500" /><span>{t('explorer.new_txt')}</span></button>
                  <button onClick={() => openNewFileModal('.py')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] text-left font-semibold text-slate-700 dark:text-slate-200"><FileCode size={14} className="text-cyan-500" /><span>{t('explorer.new_py')}</span></button>
                  <button onClick={() => openNewFileModal('.json')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] text-left font-semibold text-slate-700 dark:text-slate-200"><FileCode size={14} className="text-emerald-500" /><span>{t('explorer.new_json')}</span></button>
                  <div className="h-[1px] bg-slate-100 dark:bg-[#2e2e34] my-1" />
                  <button onClick={() => openNewFileModal('')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] text-left font-semibold text-slate-700 dark:text-slate-200"><FileIcon size={14} className="text-slate-400" /><span>{t('explorer.new_other')}</span></button>
                </div>
              )}
            </div>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-[#333338] mx-1" />
            <button onClick={handleCopy} disabled={selectedPaths.length === 0} className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272a] disabled:opacity-30" title={t('explorer.tooltip_copy')}><Copy size={15} /></button>
            <button onClick={handleCut} disabled={selectedPaths.length === 0} className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272a] disabled:opacity-30" title={t('explorer.tooltip_cut')}><Scissors size={15} /></button>
            <button onClick={handlePaste} disabled={!clipboard} className={`p-1.5 rounded-xl transition-colors ${clipboard ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40' : 'text-slate-400 opacity-30 cursor-not-allowed'}`} title={t('explorer.tooltip_paste')}><ClipboardPaste size={15} /></button>

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-[#333338] mx-1" />
            <button onClick={() => { if (selectedPaths.length === 1) { const target = items.find(i => i.path === selectedPaths[0]); if (target) openRenameModal(target); } }} disabled={selectedPaths.length !== 1} className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272a] disabled:opacity-30" title={t('explorer.tooltip_rename')}><Edit3 size={15} /></button>
            <button onClick={() => setShowDeleteModal(true)} disabled={selectedPaths.length === 0} className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30" title={t('explorer.tooltip_delete')}><Trash2 size={15} /></button>
            <button onClick={handleCompressZip} disabled={selectedPaths.length === 0} className="p-1.5 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-30" title={t('explorer.tooltip_zip')}><FileArchive size={15} /></button>
            <button onClick={() => { if (selectedPaths[0]) handleInspectProperties(selectedPaths[0]); }} disabled={selectedPaths.length !== 1} className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#27272a] disabled:opacity-30" title={t('explorer.tooltip_props')}><Info size={15} /></button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">{filteredAndSortedItems.length} {t('explorer.items_count')} {selectedPaths.length > 0 && `(${selectedPaths.length} ${t('explorer.sel_count')})`}</span>
            <div className="flex items-center bg-slate-100 dark:bg-[#27272a] p-0.5 rounded-xl border border-slate-200 dark:border-[#383840]">
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-[#18181b] text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`} title={t('explorer.view_list')}><LayoutList size={14} /></button>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-[#18181b] text-blue-600 shadow-xs' : 'text-slate-400 hover:text-slate-600'}`} title={t('explorer.view_grid')}><LayoutGrid size={14} /></button>
            </div>
          </div>
        </div>

        {/* ⚡ ÁREA DE ARQUIVOS VIRTUALIZADA */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onClick={() => setSelectedPaths([])} 
          className="flex-1 overflow-y-auto border border-slate-100 dark:border-[#2e2e34] rounded-xl bg-slate-50/50 dark:bg-[#18181b]/50 custom-scrollbar relative flex flex-col"
        >
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 gap-2"><RefreshCw size={16} className="animate-spin text-blue-500" /><span>{t('explorer.loading')}</span></div>
          ) : filteredAndSortedItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic">{t('explorer.empty_folder')}</div>
          ) : viewMode === 'list' ? (
            
            <div className="flex-1 flex flex-col relative w-full text-xs">
              <div className="sticky top-0 bg-slate-100 dark:bg-[#202024] text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-[#2e2e34] z-20 flex items-stretch select-none">
                <div className="w-10 p-2.5 text-center shrink-0 border-r border-transparent">
                  <input type="checkbox" className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={isAllSelected} onChange={handleSelectAll} onClick={(e) => e.stopPropagation()} />
                </div>
                <div style={{ width: colWidths.name }} className="p-2.5 pl-4 relative group shrink-0">
                  <div onClick={() => handleHeaderSort('name')} className="flex items-center gap-1 cursor-pointer hover:text-blue-600 truncate"><span>{t('explorer.col_name')}</span>{sortField === 'name' && <ArrowUpDown size={11} className="text-blue-500 shrink-0" />}</div>
                  <div onMouseDown={(e) => startColResizing('name', e)} onDoubleClick={() => resetColWidth('name')} className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors" />
                </div>
                <div style={{ width: colWidths.size }} className="p-2.5 relative group shrink-0">
                  <div onClick={() => handleHeaderSort('size')} className="flex items-center gap-1 cursor-pointer hover:text-blue-600 truncate"><span>{t('explorer.col_size')}</span>{sortField === 'size' && <ArrowUpDown size={11} className="text-blue-500 shrink-0" />}</div>
                  <div onMouseDown={(e) => startColResizing('size', e)} onDoubleClick={() => resetColWidth('size')} className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors" />
                </div>
                <div style={{ width: colWidths.type }} className="p-2.5 relative group shrink-0">
                  <div onClick={() => handleHeaderSort('type')} className="flex items-center gap-1 cursor-pointer hover:text-blue-600 truncate"><span>{t('explorer.col_type')}</span>{sortField === 'type' && <ArrowUpDown size={11} className="text-blue-500 shrink-0" />}</div>
                  <div onMouseDown={(e) => startColResizing('type', e)} onDoubleClick={() => resetColWidth('type')} className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors" />
                </div>
                <div style={{ width: colWidths.date }} className="p-2.5 relative group shrink-0">
                  <div onClick={() => handleHeaderSort('date')} className="flex items-center gap-1 cursor-pointer hover:text-blue-600 truncate"><span>{t('explorer.col_date')}</span>{sortField === 'date' && <ArrowUpDown size={11} className="text-blue-500 shrink-0" />}</div>
                  <div onMouseDown={(e) => startColResizing('date', e)} onDoubleClick={() => resetColWidth('date')} className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors" />
                </div>
                <div className="flex-1" />
              </div>

              <div style={{ height: totalItems * ROW_HEIGHT, position: 'relative', width: '100%' }}>
                {visibleListItems.map((item, index) => {
                  const isSelected = selectedPaths.includes(item.path);
                  const absoluteIndex = startRow + index;
                  return (
                    <div
                      key={item.path}
                      onClick={(e) => handleItemClick(item, absoluteIndex, e)}
                      onDoubleClick={() => handleItemDoubleClick(item)}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                      style={{ position: 'absolute', top: absoluteIndex * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT }}
                      className={`flex items-center border-b border-slate-100 dark:border-[#25252a] cursor-pointer transition-colors group ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold' : 'hover:bg-slate-50 dark:hover:bg-[#232328] text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="w-10 text-center shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: isSelected ? 1 : undefined }} checked={isSelected} onChange={(e) => handleCheckboxChange(item, e)} />
                      </div>
                      <div style={{ width: colWidths.name }} className="p-2 pl-4 flex items-center gap-2.5 truncate shrink-0">
                        {getFileCategoryIcon(item)}<span className="truncate" title={item.name}>{item.name}</span>
                      </div>
                      <div style={{ width: colWidths.size }} className="p-2 font-mono text-[11px] text-slate-400 truncate shrink-0">{item.is_dir ? '--' : (item.size_formatted || `${item.size_bytes || 0} B`)}</div>
                      <div style={{ width: colWidths.type }} className="p-2 font-mono text-[10px] uppercase text-slate-400 truncate shrink-0">{item.is_dir ? t('explorer.type_folder') : (item.extension || t('explorer.type_file'))}</div>
                      <div style={{ width: colWidths.date }} className="p-2 font-mono text-[11px] text-slate-400 truncate shrink-0">{item.last_modified || item.modified_at || '--'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ height: totalGridRows * GRID_ITEM_HEIGHT, position: 'relative', width: '100%', padding: '12px' }}>
              {visibleGridItems.map((item, index) => {
                const isSelected = selectedPaths.includes(item.path);
                const absoluteIndex = (startGridRow * cols) + index;
                const row = Math.floor(absoluteIndex / cols);
                const col = absoluteIndex % cols;

                return (
                  <div
                    key={item.path}
                    onClick={(e) => handleItemClick(item, absoluteIndex, e)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    style={{ position: 'absolute', top: (row * GRID_ITEM_HEIGHT) + 12, left: `calc(${(100 / cols) * col}% + 12px)`, width: `calc(${100 / cols}% - 24px)`, height: GRID_ITEM_HEIGHT - 12 }}
                    className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-2 cursor-pointer transition-all group ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-xs' : 'bg-white dark:bg-[#1e1e24] border-slate-200 dark:border-[#2e2e34] hover:bg-slate-50 dark:hover:bg-[#27272d]'
                    }`}
                  >
                    <div className={`absolute top-2 left-2 z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`} onClick={(e) => { e.stopPropagation(); const evt = { target: { checked: !isSelected }, stopPropagation: () => {} } as any; handleCheckboxChange(item, evt); }}>
                      {isSelected ? <CheckSquare size={16} className="text-blue-600 bg-white rounded-sm" /> : <Square size={16} className="text-slate-400 bg-white rounded-sm" />}
                    </div>

                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#25252b]">{getFileCategoryIcon(item)}</div>
                    <div className="w-full">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate w-full" title={item.name}>{item.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">{item.is_dir ? t('explorer.type_folder') : (item.size_formatted || `${item.size_bytes} B`)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAIS DO EXPLORADOR */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#202023] w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-[#333338] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-2.5 text-red-500">
              <AlertTriangle size={20} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">{t('explorer.modal_del_title')}</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('explorer.modal_del_desc_1')} <strong className="text-red-500">{selectedPaths.length === 1 ? t('explorer.modal_del_item') : `${selectedPaths.length} ${t('explorer.modal_del_items')}`}</strong>{t('explorer.modal_del_desc_2')}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">{t('explorer.btn_cancel')}</button>
              <button onClick={executeDelete} className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-sm transition-colors">{t('explorer.btn_yes_delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ NOVO MODAL DE COMPACTAÇÃO (ZIP) */}
      {showZipModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#202023] w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-[#333338] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileArchive size={16} className="text-amber-500" /> {t('explorer.modal_zip_title')}
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{t('explorer.modal_zip_name')}</label>
              <input type="text" value={zipFileName} onChange={(e) => setZipFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeCompressZip()} autoFocus className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#333338] rounded-xl text-slate-800 dark:text-white font-medium outline-none" />
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#2e2e34]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Lock size={15} className="text-emerald-500" /> {t('explorer.modal_zip_protect')}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={zipEncrypt} onChange={(e) => setZipEncrypt(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-[#333338] peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              {zipEncrypt && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#2d2d34] relative">
                  <input type={showZipPassword ? "text" : "password"} placeholder={t('explorer.modal_zip_pass_ph')} value={zipPassword} onChange={(e) => setZipPassword(e.target.value)} className="w-full pl-3 pr-10 py-2 text-xs bg-white dark:bg-[#202024] border border-slate-200 dark:border-[#383840] rounded-xl outline-none font-mono focus:ring-1 focus:ring-emerald-500 transition-shadow" />
                  <button type="button" onClick={() => setShowZipPassword(!showZipPassword)} className="absolute right-3 top-[22px] text-slate-400 hover:text-emerald-500 transition-colors">
                    {showZipPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowZipModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">{t('explorer.btn_cancel')}</button>
              <button onClick={executeCompressZip} className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm transition-transform active:scale-95" style={{ backgroundColor: accentColor }}>{t('explorer.btn_compress')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ MENU DE CONTEXTO NATIVO */}
      {contextMenu.visible && (
        <div 
          id="custom-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }} 
          onClick={(e) => e.stopPropagation()} 
          onContextMenu={(e) => e.preventDefault()}
          className="fixed z-[9999] w-56 bg-white dark:bg-[#202024] rounded-2xl border border-slate-200 dark:border-[#333338] shadow-2xl p-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-100"
        >
          <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); handleItemDoubleClick(contextMenu.targetItem!); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] font-semibold">
            {contextMenu.targetItem?.is_dir ? <Folder size={14} className="text-blue-500" /> : <FileIcon size={14} className="text-blue-500" />}
            <span>{contextMenu.targetItem?.is_dir ? t('explorer.ctx_open_folder') : t('explorer.ctx_open_file')}</span>
          </button>
          
          {!contextMenu.targetItem?.is_dir && (
            <button onClick={async () => { 
              setContextMenu(prev => ({ ...prev, visible: false })); 
              try { await invoke('open_with_dialog', { path: contextMenu.targetItem!.path }); } 
              catch (e) { alert(e); }
            }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] font-semibold">
              <LayoutGrid size={14} className="text-purple-500" />
              <span>{t('explorer.ctx_open_with')}</span>
            </button>
          )}
          
          {onSetSource && contextMenu.targetItem?.is_dir && (
            <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); onSetSource(contextMenu.targetItem!.path); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32] font-semibold text-blue-600 dark:text-blue-400">
              <FolderInput size={14} /><span>{t('explorer.ctx_use_source')}</span>
            </button>
          )}
          
          {contextMenu.targetItem?.is_dir && (
            <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); toggleFavorite(contextMenu.targetItem!); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32]">
              <Star size={14} className="text-amber-500" /><span>{isPathFavorite(contextMenu.targetItem.path) ? t('explorer.ctx_unpin') : t('explorer.ctx_pin')}</span>
            </button>
          )}
          
          <div className="h-[1px] bg-slate-100 dark:bg-[#2e2e34] my-1" />
          <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); handleCopy(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32]"><Copy size={14} /><span>{t('explorer.ctx_copy')}</span></button>
          <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); handleCut(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32]"><Scissors size={14} /><span>{t('explorer.ctx_cut')}</span></button>
          <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); openRenameModal(contextMenu.targetItem!); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32]"><Edit3 size={14} /><span>{t('explorer.ctx_rename')}</span></button>
          <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); handleCompressZip(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32]"><FileArchive size={14} className="text-amber-500" /><span>{t('explorer.ctx_zip')}</span></button>
          <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); setShowDeleteModal(true); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 font-semibold"><Trash2 size={14} /><span>{t('explorer.ctx_delete')}</span></button>
          <div className="h-[1px] bg-slate-100 dark:bg-[#2e2e34] my-1" />
          <button onClick={() => { setContextMenu(prev => ({ ...prev, visible: false })); handleInspectProperties(contextMenu.targetItem!.path); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2b2b32]"><Info size={14} /><span>{t('explorer.ctx_props')}</span></button>
        </div>
      )}

      {/* OUTROS MODAIS */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#202023] w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-[#333338] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{t('explorer.modal_folder_title')}</h3>
            <input type="text" placeholder={t('explorer.modal_folder_ph')} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} autoFocus className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#333338] rounded-xl text-slate-800 dark:text-white font-medium outline-none" />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowNewFolderModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600">{t('explorer.btn_cancel')}</button>
              <button onClick={handleCreateFolder} className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm" style={{ backgroundColor: accentColor }}>{t('explorer.btn_create_folder')}</button>
            </div>
          </div>
        </div>
      )}

      {showNewFileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#202023] w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-[#333338] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {newFileDefaultExt ? `${t('explorer.modal_file_title_1')} ${newFileDefaultExt}` : t('explorer.modal_file_title_2')}
            </h3>
            <div className="space-y-1">
              <input type="text" placeholder={newFileDefaultExt ? `${t('explorer.modal_file_ph_1')}${newFileDefaultExt})` : t('explorer.modal_file_ph_2')} value={newFileName} onChange={(e) => setNewFileName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()} autoFocus className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#333338] rounded-xl text-slate-800 dark:text-white font-medium outline-none" />
              {!newFileDefaultExt && <p className="text-[10px] text-slate-400 px-1">{t('explorer.modal_file_hint')}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowNewFileModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600">{t('explorer.btn_cancel')}</button>
              <button onClick={handleCreateFile} className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm" style={{ backgroundColor: accentColor }}>{t('explorer.btn_create_file')}</button>
            </div>
          </div>
        </div>
      )}

      {showRenameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#202023] w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-[#333338] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{t('explorer.modal_rename_title')}</h3>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRename()} autoFocus className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#333338] rounded-xl text-slate-800 dark:text-white font-medium outline-none" />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowRenameModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600">{t('explorer.btn_cancel')}</button>
              <button onClick={handleRename} className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-sm" style={{ backgroundColor: accentColor }}>{t('explorer.btn_save')}</button>
            </div>
          </div>
        </div>
      )}

      {propertiesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-[#202023] w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-[#333338] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2e2e34] pb-3">
              <div className="flex items-center gap-2"><Info size={16} className="text-blue-500" /><h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{propertiesModal.is_dir ? t('explorer.modal_props_title_dir') : t('explorer.modal_props_title_file')}</h3></div>
              <button onClick={() => setPropertiesModal(null)} className="text-slate-400 hover:text-white"><X size={15} /></button>
            </div>
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-100 dark:border-[#2d2d34] space-y-1.5 font-mono text-[11px]">
                <p><strong className="text-slate-700 dark:text-slate-200 font-sans">{t('explorer.props_name')}</strong> {propertiesModal.name}</p>
                <p className="break-all"><strong className="text-slate-700 dark:text-slate-200 font-sans">{t('explorer.props_path')}</strong> {propertiesModal.full_path || propertiesModal.path}</p>
                <p><strong className="text-slate-700 dark:text-slate-200 font-sans">{t('explorer.props_size')}</strong> {propertiesModal.size_formatted || `${propertiesModal.size_bytes} Bytes`}</p>
                <p><strong className="text-slate-700 dark:text-slate-200 font-sans">{t('explorer.props_created')}</strong> {propertiesModal.created_at || '--'}</p>
                <p><strong className="text-slate-700 dark:text-slate-200 font-sans">{t('explorer.props_modified')}</strong> {propertiesModal.modified_at || '--'}</p>
                <p><strong className="text-slate-700 dark:text-slate-200 font-sans">{t('explorer.props_attr')}</strong> {propertiesModal.is_readonly ? t('explorer.props_readonly') : t('explorer.props_readwrite')}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setPropertiesModal(null)} className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-[#27272a] text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors">{t('explorer.btn_close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
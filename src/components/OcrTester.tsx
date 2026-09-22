import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { FileScan, Copy, CheckCircle2, Trash2, FileText, AlertCircle, Download, FileCode2, FileSpreadsheet, Layers, Link, Scissors, RefreshCw, Printer, FileBadge } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OcrExtractionResult {
  path: string;
  extracted_text: string | null;
  success: boolean;
  message: string | null;
}

export const OcrTester: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileSelect = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'Documentos e Imagens',
          extensions: ['png', 'jpg', 'jpeg', 'pdf', 'tif', 'bmp', 'docx']
        }]
      });

      if (!selectedPath) return;

      const pathString = selectedPath as string;
      const extractedName = pathString.split('\\').pop()?.split('/').pop() || 'Arquivo Desconhecido';
      
      setFileName(extractedName);
      setLoading(true);
      setError(null);
      setResult('');
      setCopied(false);

      const response = await invoke<OcrExtractionResult>("extract_ocr_text_command", { 
        filePath: selectedPath 
      });

      if (response.success) {
        setResult(response.extracted_text || "O arquivo foi lido, mas nenhum texto foi encontrado.");
      } else {
        setError(response.message || "Falha ao processar o arquivo.");
      }
    } catch (e: any) {
      setError(`Erro de comunicação com o sistema: ${e.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setResult('');
    setError(null);
    setFileName(null);
  };

  // ⚡ Exportação para Texto Simples, MD e CSV
  const handleExportFile = async (format: 'txt' | 'md' | 'csv') => {
    if (!result.trim()) return;
    try {
      const defaultName = fileName ? fileName.split('.')[0] : 'Dados_Extraidos';
      const filePath = await save({
        filters: [{ name: `Arquivo ${format.toUpperCase()}`, extensions: [format] }],
        defaultPath: `${defaultName}.${format}`
      });

      if (!filePath) return; 

      await invoke('export_text_to_file_command', { text: result, destPath: filePath });
      alert(`Conversão concluída! Arquivo salvo em:\n${filePath}`);
    } catch (e) {
      alert(`Erro crítico durante a conversão do arquivo: ${e}`);
    }
  };

  // ⚡ NOVO: Exportação Rica (PDF e DOCX) do texto extraído
  const handleExportRich = async (format: 'pdf' | 'docx') => {
    if (!result.trim()) return;
    try {
      const defaultName = fileName ? fileName.split('.')[0] : 'Dados_Extraidos';
      const filePath = await save({
        filters: [{ name: format === 'pdf' ? 'Arquivo PDF' : 'Documento Word', extensions: [format] }],
        defaultPath: `${defaultName}_Tratado.${format}`
      });

      if (!filePath) return; 

      setLoading(true);
      const msg = await invoke<string>('export_text_to_word_pdf_command', { 
        text: result, 
        destPath: filePath,
        asPdf: format === 'pdf'
      });
      alert(msg);
    } catch (e) {
      alert(`Erro crítico durante a exportação rica: ${e}\nVerifique se o MS Word está instalado.`);
    } finally {
      setLoading(false);
    }
  };

  // ⚡ MÉTODOS NATIVOS DE PDF E WORD...
  const handleMergePdfs = async () => { /* Mantém seu código existente */
    try {
      const files = await open({ multiple: true, filters: [{ name: 'Arquivos PDF', extensions: ['pdf'] }] });
      if (!files || !Array.isArray(files) || files.length < 2) { alert("Selecione pelo menos 2 arquivos PDF."); return; }
      const savePath = await save({ filters: [{ name: 'Arquivo PDF', extensions: ['pdf'] }], defaultPath: 'Documentos_Mesclados.pdf' });
      if (!savePath) return;
      setLoading(true);
      const msg = await invoke<string>('merge_pdfs_command', { filePaths: files, outputPath: savePath });
      alert(msg);
    } catch (e) { alert(`Erro ao mesclar PDFs: ${e}`); } finally { setLoading(false); }
  };

  const handleSplitPdf = async () => { /* Mantém seu código existente */
    try {
      const file = await open({ multiple: false, filters: [{ name: 'Arquivo PDF', extensions: ['pdf'] }] });
      if (!file || typeof file !== 'string') return;
      const saveDir = await open({ directory: true, multiple: false, title: 'Selecione a pasta' });
      if (!saveDir || typeof saveDir !== 'string') return;
      const prefix = prompt("Digite um prefixo:", "Pagina");
      if (!prefix) return;
      setLoading(true);
      const msg = await invoke<string>('split_pdf_command', { filePath: file, outputDir: saveDir, prefix });
      alert(msg);
    } catch (e) { alert(`Erro ao separar PDF: ${e}`); } finally { setLoading(false); }
  };

  const handleConvertDocxToPdf = async () => { /* Mantém seu código existente */
    try {
      const file = await open({ multiple: false, filters: [{ name: 'Documento Word', extensions: ['docx', 'doc'] }] });
      if (!file || typeof file !== 'string') return;
      const savePath = await save({ filters: [{ name: 'Arquivo PDF', extensions: ['pdf'] }], defaultPath: 'Convertido.pdf' });
      if (!savePath) return;
      setLoading(true);
      const msg = await invoke<string>('convert_docx_to_pdf_command', { sourcePath: file, destPath: savePath });
      alert(msg);
    } catch (e) { alert(`Erro: ${e}`); } finally { setLoading(false); }
  };

  const handleConvertPdfToDocx = async () => { /* Mantém seu código existente */
    try {
      const file = await open({ multiple: false, filters: [{ name: 'Arquivo PDF', extensions: ['pdf'] }] });
      if (!file || typeof file !== 'string') return;
      const savePath = await save({ filters: [{ name: 'Documento Word', extensions: ['docx'] }], defaultPath: 'Convertido.docx' });
      if (!savePath) return;
      setLoading(true);
      const msg = await invoke<string>('convert_pdf_to_docx_command', { sourcePath: file, destPath: savePath });
      alert(msg);
    } catch (e) { alert(`Erro: ${e}`); } finally { setLoading(false); }
  };

  const handlePrintDocument = async () => { /* Mantém seu código existente */
    try {
      const file = await open({ multiple: false, filters: [{ name: 'Documentos e Imagens', extensions: ['pdf', 'docx', 'jpg', 'png'] }] });
      if (!file || typeof file !== 'string') return;
      setLoading(true);
      const msg = await invoke<string>('print_document_command', { filePath: file });
      if (msg !== "Impressão cancelada pelo utilizador." && msg !== "Impressão cancelada pelo usuário.") alert(msg);
    } catch (e) { alert(`Erro: ${e}`); } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1 custom-scrollbar">
      
      <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <FileScan size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Estúdio de Documentos</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Extração profunda de texto, análise visual (OCR) e conversão estrutural de documentos.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        
        {/* Painel Esquerdo: Controles */}
        <div className="w-full md:w-1/3 flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar pr-1 pb-4">
          
          <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-col gap-4 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              Entrada de Dados
            </h3>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Selecione um documento para análise. O motor suporta PDFs, <strong>documentos do Word (.DOCX)</strong> e formatos de imagem (PNG, JPG, TIFF).
            </p>

            <button
              onClick={handleFileSelect}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-blue-500/25 active:scale-[0.98] flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                'Selecionar Arquivo'
              )}
            </button>

            {fileName && !loading && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-100 dark:border-[#2b2b30] flex items-center justify-between animate-in fade-in">
                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate pr-2">
                  {fileName}
                </span>
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              </div>
            )}
          </div>

          <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-col gap-4 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Download size={16} className="text-emerald-500" />
              Conversão e Exportação
            </h3>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Edite o texto extraído no painel ao lado e exporte o resultado tratado para formatos universais.
            </p>

            {/* ⚡ GRID ATUALIZADO: Agora com 4 Botões (TXT, MD, PDF, DOCX) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <button 
                onClick={() => handleExportFile('txt')}
                disabled={!result || loading}
                className="px-3 py-2.5 bg-slate-50 dark:bg-[#18181b] hover:bg-slate-100 dark:hover:bg-[#20242c] disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-[#343a45] transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText size={14} /> Texto Simples
              </button>
              
              <button 
                onClick={() => handleExportFile('md')}
                disabled={!result || loading}
                className="px-3 py-2.5 bg-slate-50 dark:bg-[#18181b] hover:bg-slate-100 dark:hover:bg-[#20242c] disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-[#343a45] transition-colors flex items-center justify-center gap-1.5"
              >
                <FileCode2 size={14} /> Markdown
              </button>

              <button 
                onClick={() => handleExportRich('pdf')}
                disabled={!result || loading}
                className="px-3 py-2.5 bg-slate-50 dark:bg-[#18181b] hover:bg-slate-100 dark:hover:bg-[#20242c] disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-[#343a45] transition-colors flex items-center justify-center gap-1.5"
              >
                <FileBadge size={14} /> Salvar PDF
              </button>

              <button 
                onClick={() => handleExportRich('docx')}
                disabled={!result || loading}
                className="px-3 py-2.5 bg-slate-50 dark:bg-[#18181b] hover:bg-slate-100 dark:hover:bg-[#20242c] disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-[#343a45] transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText size={14} className="text-blue-500" /> Salvar DOCX
              </button>
            </div>
            
            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-[#2a2e37]">
               <button 
                 onClick={() => handleExportFile('csv')}
                 disabled={!result || loading}
                 className="w-full px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:opacity-40 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/50 transition-colors flex items-center justify-center gap-1.5"
                 title="Salvar formato de planilha compatível com Excel"
               >
                 <FileSpreadsheet size={14} /> Exportar Planilha (CSV)
               </button>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-col gap-4 shrink-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Layers size={16} className="text-purple-500" />
              Utilitários de Documento
            </h3>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Junte, separe e converta documentos nativamente usando o motor do seu sistema operativo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <button 
                onClick={handleMergePdfs}
                disabled={loading}
                className="px-3 py-2.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-40 text-purple-700 dark:text-purple-400 text-[11px] font-bold rounded-xl border border-purple-200 dark:border-purple-800/50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Link size={14} /> Mesclar PDFs
              </button>
              
              <button 
                onClick={handleSplitPdf}
                disabled={loading}
                className="px-3 py-2.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-40 text-purple-700 dark:text-purple-400 text-[11px] font-bold rounded-xl border border-purple-200 dark:border-purple-800/50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Scissors size={14} /> Separar Páginas
              </button>

              <button 
                 onClick={handleConvertDocxToPdf}
                 disabled={loading}
                 className="px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-40 text-indigo-700 dark:text-indigo-400 text-[11px] font-bold rounded-xl border border-indigo-200 dark:border-indigo-800/50 transition-colors flex items-center justify-center gap-1.5"
               >
                 <RefreshCw size={14} /> DOCX para PDF
              </button>

              <button 
                 onClick={handleConvertPdfToDocx}
                 disabled={loading}
                 className="px-3 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 disabled:opacity-40 text-indigo-700 dark:text-indigo-400 text-[11px] font-bold rounded-xl border border-indigo-200 dark:border-indigo-800/50 transition-colors flex items-center justify-center gap-1.5"
               >
                 <RefreshCw size={14} /> PDF para DOCX
              </button>
            </div>

            <div className="pt-2 mt-1 border-t border-slate-100 dark:border-[#2a2e37]">
               <button 
                 onClick={handlePrintDocument}
                 disabled={loading}
                 className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#18181b] hover:bg-slate-100 dark:hover:bg-[#20242c] disabled:opacity-40 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-[#343a45] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
               >
                 <Printer size={14} /> Imprimir / PDF24
               </button>
            </div>
          </div>

        </div>

        {/* Painel Direito: Resultados Editáveis */}
        <div className="flex-1 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm p-5 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2b2b30] pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Editor de Dados Extraídos</h3>
            
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                disabled={!result}
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-30 transition-colors"
                title="Copiar texto"
              >
                {copied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
              <button
                onClick={handleClear}
                disabled={!result && !error}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-30 transition-colors"
                title="Limpar resultados"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 rounded-xl border border-slate-100 dark:border-[#2b2b30] overflow-hidden flex flex-col relative bg-slate-50 dark:bg-[#13161b]">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-[#18181b]/80 backdrop-blur-sm z-10 animate-in fade-in">
                 <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-900/50 border-t-blue-600 rounded-full animate-spin mb-3" />
                 <span className="text-xs font-bold text-slate-500 animate-pulse">O Motor está trabalhando...</span>
              </div>
            ) : null}

            {error ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 animate-in slide-in-from-bottom-4 p-4">
                <AlertCircle size={32} className="text-red-500/80" />
                <span className="text-sm font-bold text-red-600 dark:text-red-400">Erro na Análise</span>
                <span className="text-xs text-red-500/70 max-w-md">{error}</span>
              </div>
            ) : (
              <textarea 
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="Os dados extraídos do seu PDF, DOCX ou Imagem aparecerão aqui. Você pode editar este texto antes de exportar..."
                className="w-full h-full resize-none bg-transparent p-4 text-[11px] sm:text-xs font-mono text-slate-700 dark:text-emerald-400 outline-none custom-scrollbar placeholder-slate-400 dark:placeholder-slate-700"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcrTester;
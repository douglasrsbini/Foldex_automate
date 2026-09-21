import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { FileScan, Copy, CheckCircle2, Trash2, FileText, AlertCircle } from 'lucide-react';
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
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileSelect = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'Documentos e Imagens',
          extensions: ['png', 'jpg', 'jpeg', 'pdf', 'tif', 'bmp']
        }]
      });

      if (!selectedPath) return;

      // Extrai o nome do arquivo do caminho completo
      const pathString = selectedPath as string;
      const extractedName = pathString.split('\\').pop()?.split('/').pop() || 'Arquivo Desconhecido';
      
      setFileName(extractedName);
      setLoading(true);
      setError(null);
      setResult(null);
      setCopied(false);

      const response = await invoke<OcrExtractionResult>("extract_ocr_text_command", { 
        filePath: selectedPath 
      });

      if (response.success) {
        setResult(response.extracted_text || "O arquivo foi lido, mas nenhum texto legível foi encontrado.");
      } else {
        setError(response.message || "Falha ao processar o arquivo no motor de OCR.");
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
    setResult(null);
    setError(null);
    setFileName(null);
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-1">
      {/* Cabeçalho da Tela */}
      <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <FileScan size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Tratamento de Arquivos</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Extração de texto via Inteligência Computacional (OCR) para PDFs escaneados e imagens.
            </p>
          </div>
        </div>
      </div>

      {/* Área de Ação e Resultados */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        
        {/* Painel Esquerdo: Controles */}
        <div className="w-full md:w-1/3 flex flex-col gap-4 shrink-0">
          <div className="p-5 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileText size={16} className="text-slate-400" />
              Entrada de Dados
            </h3>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Selecione um documento para análise. O motor suporta nativamente arquivos PDF e formatos de imagem (PNG, JPG, TIFF).
            </p>

            <button
              onClick={handleFileSelect}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-blue-500/25 active:scale-[0.98] flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analisando...
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

          {/* Espaço reservado para futuras ferramentas de conversão */}
          <div className="p-5 bg-slate-50 dark:bg-[#1e1e24]/50 rounded-2xl border border-dashed border-slate-200 dark:border-[#2e2e34] shadow-sm flex-1 flex flex-col items-center justify-center text-center opacity-60">
            <span className="text-xs font-bold text-slate-400 mb-1">Ferramentas Futuras</span>
            <span className="text-[10px] text-slate-500 px-4">A conversão para PDF, DOCX e XLSX será implementada nesta área.</span>
          </div>
        </div>

        {/* Painel Direito: Resultados */}
        <div className="flex-1 bg-white dark:bg-[#1e1e24] rounded-2xl border border-slate-200 dark:border-[#2e2e34] shadow-sm p-5 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#2b2b30] pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Resultado da Extração</h3>
            
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

          <div className="flex-1 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-100 dark:border-[#2b2b30] p-4 overflow-hidden flex flex-col relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-[#18181b]/80 backdrop-blur-sm z-10 animate-in fade-in">
                 <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-900/50 border-t-blue-600 rounded-full animate-spin mb-3" />
                 <span className="text-xs font-bold text-slate-500 animate-pulse">O Motor está processando a imagem...</span>
              </div>
            ) : null}

            {error ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 animate-in slide-in-from-bottom-4">
                <AlertCircle size={32} className="text-red-500/80" />
                <span className="text-sm font-bold text-red-600 dark:text-red-400">Erro na Extração</span>
                <span className="text-xs text-red-500/70 max-w-md">{error}</span>
              </div>
            ) : result ? (
              <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                <pre className="text-[11px] sm:text-xs font-mono text-slate-700 dark:text-emerald-400 whitespace-pre-wrap break-words">
                  {result}
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-600">Nenhum documento analisado.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OcrTester;
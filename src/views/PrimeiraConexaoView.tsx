import React, { useState } from "react";
import {
  Database,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useSupervisao } from "../context/SupervisaoContext";
import {
  OFFICIAL_SPREADSHEET_ID,
  OFFICIAL_SPREADSHEET_NAME,
} from "../services/googleSheetsService";

export const PrimeiraConexaoView: React.FC = () => {
  const { loginGoogle, connectionErrorMessage, connectionStatus } =
    useSupervisao();
  const [loading, setLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const handleConectar = async () => {
    setLoading(true);
    setErrorLocal(null);
    try {
      await loginGoogle();
    } catch (err: any) {
      console.error("Falha na primeira sincronização:", err);
      setErrorLocal(err?.message || "Falha ao autenticar com o Google Sheets.");
    } finally {
      setLoading(false);
    }
  };

  const isCarregando = loading || connectionStatus === "CARREGANDO";

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 sm:p-8 bg-slate-50 border-b border-slate-100 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs mb-3">
            <Database className="w-7 h-7" />
          </div>
          <h1 className="prisma-title text-3xl text-slate-900">PRISMA</h1>
          <p className="text-xs text-slate-500 font-medium">
            Supervisão Acadêmica
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-600">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>Fonte Oficial de Dados:</span>
            </div>
            <div className="font-semibold text-slate-800">
              {OFFICIAL_SPREADSHEET_NAME}
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-800">
              Primeira inicialização necessária:
            </p>
            <p>
              Para acessar informações acadêmicas, entre com a conta Google
              autorizada na planilha oficial. Os dados do dispositivo não serão
              exibidos enquanto você não estiver autenticada.
            </p>
            <p className="text-[11px] text-slate-400">
              O sistema guarda uma cópia de trabalho no dispositivo e sinaliza
              alterações que aguardam envio. Antes de encerrar a supervisão,
              confirme o indicador de sincronização remota.
            </p>
          </div>

          {(errorLocal || connectionErrorMessage) && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">
                  Erro ao conectar à planilha:
                </strong>
                <p className="text-[11px] mt-0.5">
                  {errorLocal || connectionErrorMessage}
                </p>
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={handleConectar}
            disabled={isCarregando}
            className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-md cursor-pointer transition-all"
          >
            {isCarregando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Carregando e validando base oficial...</span>
              </>
            ) : (
              <>
                <span>Conectar Google Workspace & Carregar Base</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-400">
          Hierarquia: Google Sheets (Oficial) → IndexedDB (Cache Local) →
          syncQueue (Fila Segura)
        </div>
      </div>
    </div>
  );
};

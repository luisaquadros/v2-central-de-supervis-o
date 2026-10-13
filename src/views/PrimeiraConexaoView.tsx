import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSupervisao } from '../context/SupervisaoContext';
import { Botao } from '../components/ui';

/** Tela de entrada: aparece só no primeiro acesso do aparelho ou depois de sair da conta. */
export const PrimeiraConexaoView: React.FC = () => {
  const { loginGoogle, isLoggingIn, connectionErrorMessage, currentUser, spreadsheetName } = useSupervisao();

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-black">CS</div>
          <h1 className="text-2xl font-black text-slate-900">Central de Supervisão</h1>
          <p className="text-slate-600">Estágios de Psicologia</p>
        </div>

        <p className="text-slate-700 leading-relaxed">
          {currentUser
            ? 'Para trazer os dados da planilha para este aparelho, confirme o acesso à sua conta Google.'
            : 'Entre com a conta Google que tem acesso à planilha da supervisão.'}
        </p>
        <p className="text-sm text-slate-500">
          Planilha: <strong className="text-slate-700">{spreadsheetName}</strong>. Depois do primeiro acesso, o app abre
          na hora, mesmo sem internet, e envia as alterações quando a conexão voltar.
        </p>

        {connectionErrorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{connectionErrorMessage}</span>
          </div>
        )}

        <Botao variante="primario" tamanho="lg" className="w-full" onClick={loginGoogle} disabled={isLoggingIn}
          icone={isLoggingIn ? <RefreshCw className="w-5 h-5 animate-spin" /> : undefined}>
          {isLoggingIn ? 'Conectando e lendo a planilha…' : 'Entrar com Google'}
        </Botao>
      </div>
    </div>
  );
};

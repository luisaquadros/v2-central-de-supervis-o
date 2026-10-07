import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  viewName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ViewErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ViewErrorBoundary] Erro capturado na view "${this.props.viewName || 'desconhecida'}":`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const viewLabel = this.props.viewName || 'desta tela';
      const errorMessage = this.state.error?.message || 'Ocorreu um erro inesperado ao renderizar esta seção.';

      return (
        <div className="bg-white border border-red-200 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto my-6 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-3 flex-1">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  Recuperação de Erro Local
                </span>
                <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                  Falha ao exibir o conteúdo {viewLabel}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  O restante da aplicação continua funcionando normalmente. Você pode tentar recarregar esta tela ou navegar para outra área pela barra lateral.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 break-words">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold mb-1 text-[11px]">
                  <Bug className="w-3.5 h-3.5 text-red-500" />
                  <span>Detalhe técnico:</span>
                </div>
                <p className="text-red-700">{errorMessage}</p>
              </div>

              {this.state.errorInfo?.componentStack && (
                <details className="text-[11px] text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-800 font-medium">
                    Ver pilha do componente (Stack trace)
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

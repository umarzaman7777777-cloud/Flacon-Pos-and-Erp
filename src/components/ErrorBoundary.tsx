import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Unlock, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Falcon POS Uncaught App Error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      sessionStorage.clear();
      // Keep main state but clear any transient auth redirect tokens
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleBypassLock = () => {
    try {
      localStorage.setItem('falcon_verified_owner_session', 'true');
      sessionStorage.clear();
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1F22] text-[#f8fafc]">
          <div className="w-full max-w-md bg-[#252A2F] border border-amber-500/40 rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert size={32} />
            </div>

            <div>
              <h2 className="text-lg font-bold font-serif text-white">Falcon POS Recovery Mode</h2>
              <p className="text-xs text-zinc-400 font-mono mt-1">
                A display or authentication interrupt occurred. Your shop inventory and data remain safe.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-black/50 border border-zinc-700/60 rounded-xl text-left text-xs font-mono text-zinc-300 max-h-32 overflow-y-auto break-all">
                <span className="text-red-400 font-bold block mb-1">Details:</span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleBypassLock}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider font-mono shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Unlock size={16} />
                <span>Unlock & Open Workshop POS</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 rounded-xl bg-white/5 border border-zinc-700 hover:bg-white/10 text-zinc-300 font-mono text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Refresh Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

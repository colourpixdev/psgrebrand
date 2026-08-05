import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

type SaveFeedbackContextValue = {
  showSuccess: (message: string) => void;
};

const SaveFeedbackContext = createContext<SaveFeedbackContextValue | undefined>(undefined);

export function SaveFeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showSuccess = useCallback((nextMessage: string) => {
    setMessage(nextMessage);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setMessage(null);
      timeoutRef.current = null;
    }, 2800);
  }, []);

  const value = useMemo<SaveFeedbackContextValue>(() => ({ showSuccess }), [showSuccess]);

  return (
    <SaveFeedbackContext.Provider value={value}>
      {children}
      {message ? (
        <div className="pointer-events-none fixed right-4 top-4 z-[70] max-w-sm rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-50 shadow-soft backdrop-blur-md">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-200" />
            <p>{message}</p>
          </div>
        </div>
      ) : null}
    </SaveFeedbackContext.Provider>
  );
}

export function useSaveFeedback() {
  const context = useContext(SaveFeedbackContext);
  if (!context) {
    throw new Error('useSaveFeedback must be used within SaveFeedbackProvider');
  }

  return context;
}
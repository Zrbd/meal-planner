import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
interface ToastMsg {
  id: number;
  text: string;
  action?: ToastAction;
}

type ShowToast = (text: string, action?: ToastAction) => void;
const Ctx = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback<ShowToast>((text, action) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setMsg({ id, text, action });
    timer.current = window.setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), action ? 6000 : 3000);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="bottom-safe-tab pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" role="status">
          <div className="animate-fade pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
            <span className="flex-1">{msg.text}</span>
            {msg.action && (
              <button
                className="font-semibold text-green-300"
                onClick={() => {
                  void msg.action!.run();
                  setMsg(null);
                }}
              >
                {msg.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

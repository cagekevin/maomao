import React, { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

const ToastItem: React.FC<{ toast: { id: string; message: string; type: string; duration?: number }; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [exiting, setExiting] = React.useState(false);

  useEffect(() => {
    const duration = toast.duration ?? 3000;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const colors: Record<string, { bg: string; border: string; icon: string }> = {
    success: { bg: '#1a2e1a', border: '#22c55e', icon: '✓' },
    error: { bg: '#2e1a1a', border: '#ef4444', icon: '✕' },
    warning: { bg: '#2e2a1a', border: '#f59e0b', icon: '⚠' },
    info: { bg: '#1a1a2e', border: '#3b82f6', icon: 'ℹ' },
  };
  const c = colors[toast.type] || colors.info;

  return (
    <div style={{
      padding: '10px 16px', borderRadius: 8, background: c.bg,
      border: `1px solid ${c.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
      minWidth: 200, maxWidth: 400, color: '#e5e5e5',
      opacity: exiting ? 0 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      <span style={{ fontSize: 14 }}>{c.icon}</span>
      <span>{toast.message}</span>
    </div>
  );
};

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
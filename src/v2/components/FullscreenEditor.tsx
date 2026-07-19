import React, { useState, useEffect } from 'react';

interface FullscreenEditorProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

const FullscreenEditor: React.FC<FullscreenEditorProps> = ({ title, value, onChange, onClose }) => {
  const [text, setText] = useState(value);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onChange(text);
        onClose();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        onChange(text);
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [text, onChange, onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) { onChange(text); onClose(); } }}
    >
      <div style={{
        width: '80%', maxWidth: 800, height: '70%',
        background: '#fff', borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#9ca3af' }}>
            <span>Ctrl+Enter 保存</span>
            <span>Esc 退出</span>
            <button
              onClick={() => { onChange(text); onClose(); }}
              style={{
                padding: '4px 12px', background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13,
              }}
            >
              完成
            </button>
          </div>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          style={{
            flex: 1, padding: 16, border: 'none', outline: 'none',
            fontSize: 14, lineHeight: 1.6, resize: 'none',
            fontFamily: 'monospace',
          }}
        />
      </div>
    </div>
  );
};

export default FullscreenEditor;
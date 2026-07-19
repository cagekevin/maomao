/**
 * 引擎状态检测 Hook — 对齐原版 Uc() (App.js L18974)
 * 向 http://127.0.0.1:18080/api/status 发 GET
 * 已连接轮询 15s，未连接 5s
 */

import { useState, useEffect, useRef } from 'react';

const LOCAL_ENGINE_PORT = 18080;
const CONNECTED_INTERVAL = 15000;
const DISCONNECTED_INTERVAL = 5000;

interface EngineStatus {
  isConnected: boolean;
  port: number;
}

export function useLocalToolStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>({
    isConnected: false,
    port: LOCAL_ENGINE_PORT,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${LOCAL_ENGINE_PORT}/api/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus({ isConnected: data.status === 'ok' || data.ok === true, port: LOCAL_ENGINE_PORT });
        } else {
          setStatus(s => ({ ...s, isConnected: false }));
        }
      } catch {
        setStatus(s => ({ ...s, isConnected: false }));
      }
    };
    check();
    const updateInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(check, status.isConnected ? CONNECTED_INTERVAL : DISCONNECTED_INTERVAL);
    };
    updateInterval();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [status.isConnected]);

  return status;
}
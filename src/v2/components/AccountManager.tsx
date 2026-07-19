// ============================================================
// 一毛AI画布 - 多账号管理模块
// 功能：管理多个站点的账号、Cookie 读写/同步、账号切换
// ============================================================
import { useState, useEffect, useCallback } from 'react';

export interface AccountCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
  sameSite?: string;
  storeId?: string;
}

export interface Account {
  id: string;
  name: string;
  siteName: string;
  siteUrl: string;
  avatar?: string;
  cookies: AccountCookie[];
}

interface AccountManagerProps {
  onClose?: () => void;
  className?: string;
}

// LocalStorage key
const STORAGE_KEY = 'yimao_accounts';

export default function AccountManager({
  onClose,
  className = '',
}: AccountManagerProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    siteName: '',
    siteUrl: '',
  });

  // 加载账号
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setAccounts(JSON.parse(stored));
      }
    } catch {}
  }, []);

  // 保存账号
  const saveAccounts = useCallback(
    (updatedAccounts: Account[]) => {
      setAccounts(updatedAccounts);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAccounts));
      } catch {}
    },
    []
  );

  // 添加账号
  const handleAddAccount = useCallback(async () => {
    if (!newAccount.siteUrl || !newAccount.siteName) return;

    const newId = `account-${Date.now()}`;
    const account: Account = {
      id: newId,
      name: newAccount.name || newAccount.siteName,
      siteName: newAccount.siteName,
      siteUrl: newAccount.siteUrl,
      cookies: [],
    };

    // 尝试从 Chrome 扩展读取当前站点的 Cookie
    try {
      if (chrome.cookies) {
        const url = new URL(newAccount.siteUrl);
        const cookies = await chrome.cookies.getAll({ domain: url.hostname });
        account.cookies = cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          expirationDate: c.expirationDate,
          storeId: c.storeId,
        }));
      }
    } catch (e) {
      console.log('Failed to read cookies:', e);
    }

    saveAccounts([...accounts, account]);
    setShowAddForm(false);
    setNewAccount({ name: '', siteName: '', siteUrl: '' });
  }, [newAccount, accounts, saveAccounts]);

  // 删除账号
  const handleDeleteAccount = useCallback(
    (accountId: string) => {
      saveAccounts(accounts.filter((a) => a.id !== accountId));
    },
    [accounts, saveAccounts]
  );

  // 同步 Cookie（将账号中的 Cookie 写入浏览器）
  const handleSyncCookies = useCallback(
    async (account: Account) => {
      try {
        if (chrome.cookies) {
          for (const cookie of account.cookies) {
            await chrome.cookies.set({
              url: `https://${cookie.domain}`,
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              secure: cookie.secure,
              httpOnly: cookie.httpOnly,
              expirationDate: cookie.expirationDate,
              storeId: cookie.storeId,
            });
          }
          alert(`已同步 ${account.cookies.length} 个 Cookie 到 ${account.siteName}`);
        } else {
          alert('Cookie 同步仅在 Chrome 扩展环境中可用');
        }
      } catch (e) {
        console.error('Failed to sync cookies:', e);
        alert('Cookie 同步失败');
      }
    },
    []
  );

  // 刷新 Cookie
  const handleRefreshCookies = useCallback(
    async (account: Account) => {
      try {
        if (chrome.cookies) {
          const url = new URL(account.siteUrl);
          const cookies = await chrome.cookies.getAll({ domain: url.hostname });
          const updatedAccount = {
            ...account,
            cookies: cookies.map((c) => ({
              name: c.name,
              value: c.value,
              domain: c.domain,
              path: c.path,
              secure: c.secure,
              httpOnly: c.httpOnly,
              expirationDate: c.expirationDate,
              storeId: c.storeId,
            })),
          };
          saveAccounts(
            accounts.map((a) => (a.id === account.id ? updatedAccount : a))
          );
        }
      } catch (e) {
        console.error('Failed to refresh cookies:', e);
      }
    },
    [accounts, saveAccounts]
  );

  return (
    <div
      className={`account-manager ${className}`}
      style={{
        width: 320,
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 500,
        overflow: 'hidden',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid #333',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>
          👤 账号管理
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '2px 10px', fontSize: 11,
              background: '#333', border: '1px solid #555',
              borderRadius: 4, color: '#fff', cursor: 'pointer',
            }}
          >
            + 添加
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '2px 8px', fontSize: 11,
                background: 'transparent', border: '1px solid #444',
                borderRadius: 4, color: '#888', cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 添加账号表单 */}
      {showAddForm && (
        <div
          style={{
            padding: '12px',
            borderBottom: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <input
            placeholder="站点名称（如：Lovart）"
            value={newAccount.siteName}
            onChange={(e) =>
              setNewAccount({ ...newAccount, siteName: e.target.value })
            }
            style={{
              padding: '6px 10px', fontSize: 12,
              background: '#0d0d1a', border: '1px solid #444',
              borderRadius: 6, color: '#e0e0e0', outline: 'none',
            }}
          />
          <input
            placeholder="站点 URL（如：https://www.lovart.ai）"
            value={newAccount.siteUrl}
            onChange={(e) =>
              setNewAccount({ ...newAccount, siteUrl: e.target.value })
            }
            style={{
              padding: '6px 10px', fontSize: 12,
              background: '#0d0d1a', border: '1px solid #444',
              borderRadius: 6, color: '#e0e0e0', outline: 'none',
            }}
          />
          <input
            placeholder="备注名称（可选）"
            value={newAccount.name}
            onChange={(e) =>
              setNewAccount({ ...newAccount, name: e.target.value })
            }
            style={{
              padding: '6px 10px', fontSize: 12,
              background: '#0d0d1a', border: '1px solid #444',
              borderRadius: 6, color: '#e0e0e0', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={handleAddAccount}
              disabled={!newAccount.siteUrl || !newAccount.siteName}
              style={{
                flex: 1, padding: '6px 0',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none', borderRadius: 6, color: '#fff',
                fontSize: 12, cursor: 'pointer',
                opacity: !newAccount.siteUrl || !newAccount.siteName ? 0.5 : 1,
              }}
            >
              添加（自动读取 Cookie）
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{
                padding: '6px 12px',
                background: '#222', border: '1px solid #444',
                borderRadius: 6, color: '#aaa', fontSize: 12, cursor: 'pointer',
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 账号列表 */}
      <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        {accounts.length === 0 && !showAddForm && (
          <div
            style={{
              textAlign: 'center',
              color: '#555',
              fontSize: 12,
              padding: '30px 0',
            }}
          >
            暂无账号，点击"添加"开始管理
          </div>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #222',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {account.avatar && (
                  <img
                    src={account.avatar}
                    alt=""
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                    }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 12, color: '#e0e0e0' }}>
                    {account.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#666' }}>
                    {account.siteUrl}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#888' }}>
                {account.cookies.length} 个 Cookie
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => handleSyncCookies(account)}
                style={{
                  padding: '3px 10px', fontSize: 10,
                  background: '#222', border: '1px solid #444',
                  borderRadius: 4, color: '#aaa', cursor: 'pointer',
                }}
              >
                同步 Cookie
              </button>
              <button
                onClick={() => handleRefreshCookies(account)}
                style={{
                  padding: '3px 10px', fontSize: 10,
                  background: '#222', border: '1px solid #444',
                  borderRadius: 4, color: '#aaa', cursor: 'pointer',
                }}
              >
                刷新
              </button>
              <button
                onClick={() => handleDeleteAccount(account.id)}
                style={{
                  padding: '3px 10px', fontSize: 10,
                  background: '#222', border: '1px solid #444',
                  borderRadius: 4, color: '#f66', cursor: 'pointer',
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
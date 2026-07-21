/* Agent 独立页面前端逻辑优化版（解决按钮状态与乱七八糟排版问题） */
(function () {
    'use strict';

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function getUserId() {
        let id = null;
        try { id = localStorage.getItem('agent_user_id'); } catch (e) {}
        if (!id) {
            id = 'u-' + Math.random().toString(36).slice(2, 12);
            try { localStorage.setItem('agent_user_id', id); } catch (e) {}
        }
        return id;
    }
    const USER_ID = getUserId();

    const state = {
        conversations: [], activeId: '', conversation: null,
        attachments: [], sending: false, ws: null,
    };

    async function api(path, opts = {}) {
        const headers = Object.assign({ 'Content-Type': 'application/json', 'X-User-Id': USER_ID }, opts.headers || {});
        const res = await fetch(path, Object.assign({}, opts, { headers }));
        if (!res.ok) {
            let msg = '请求失败';
            try { const j = await res.json(); msg = j.detail || msg; } catch (e) {}
            throw new Error(msg);
        }
        return res.json();
    }

    function toast(msg) {
        console.warn('[agent]', msg);
        let t = $('#agentToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'agentToast';
            t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:10px 20px;border-radius:24px;font-size:14px;z-index:100;max-width:80%;box-shadow:0 10px 25px rgba(0,0,0,0.1);transition:opacity 0.3s;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = '1';
        t.style.display = 'block';
        clearTimeout(t._timer);
        t._timer = setTimeout(() => { t.style.opacity = '0'; setTimeout(()=>t.style.display='none', 300); }, 2600);
    }

    async function loadConversations() {
        const data = await api('/api/agent/conversations');
        state.conversations = data.conversations || [];
        renderChatList();
        if (!state.activeId && state.conversations.length) {
            await openConversation(state.conversations[0].id);
        } else if (!state.conversations.length) {
            await newConversation();
        }
    }

    async function newConversation() {
        const data = await api('/api/agent/conversations', { method: 'POST', body: JSON.stringify({ title: '新对话' }) });
        state.conversation = data.conversation;
        state.activeId = data.conversation.id;
        state.conversations.unshift({ id: data.conversation.id, title: data.conversation.title, updated_at: data.conversation.updated_at, message_count: 0 });
        renderChatList();
        renderMessages();
        updateTitle();
    }

    async function openConversation(id) {
        const data = await api('/api/agent/conversations/' + encodeURIComponent(id));
        state.conversation = data.conversation;
        state.activeId = id;
        state.attachments = [];
        renderChatList();
        renderMessages();
        updateTitle();
        syncToolbarFromConv();
    }

    async function deleteConversation(id) {
        await api('/api/agent/conversations/' + encodeURIComponent(id), { method: 'DELETE' });
        state.conversations = state.conversations.filter(c => c.id !== id);
        if (state.activeId === id) {
            state.activeId = ''; state.conversation = null;
            if (state.conversations.length) await openConversation(state.conversations[0].id);
            else await newConversation();
        }
        renderChatList();
    }

    function renderChatList() {
        const list = $('#agentChatList');
        list.innerHTML = '';
        if (!state.conversations.length) { list.innerHTML = '<div class="agent-chat-empty">暂无对话</div>'; return; }
        state.conversations.forEach(conv => {
            const btn = document.createElement('button');
            btn.className = 'agent-chat-item' + (conv.id === state.activeId ? ' active' : '');
            btn.dataset.id = conv.id;
            const title = document.createElement('span'); title.className = 'agent-chat-item-title'; title.textContent = conv.title || '对话';
            const time = document.createElement('span'); time.className = 'agent-chat-item-time';
            time.textContent = conv.updated_at ? new Date(conv.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '';
            const del = document.createElement('button'); del.className = 'agent-chat-item-delete'; del.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
            del.onclick = (e) => { e.stopPropagation(); if (confirm('删除该对话？')) deleteConversation(conv.id); };
            btn.appendChild(title); btn.appendChild(time); btn.appendChild(del);
            btn.onclick = () => openConversation(conv.id);
            list.appendChild(btn);
        });
        if (window.lucide) lucide.createIcons({ root: list });
    }

    function updateTitle() { $('#agentConvTitle').textContent = (state.conversation && state.conversation.title) || '新对话'; }

    async function sendMessage() {
        if (state.sending || !state.conversation) return;
        const input = $('#agentInput'); const text = input.value.trim();
        if (!text && !state.attachments.length) return;
        state.sending = true;
        const sendBtn = $('#agentSendBtn');
        sendBtn.disabled = true; sendBtn.innerHTML = '<span class="agent-spinner"></span>';
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + '/messages', {
                method: 'POST', body: JSON.stringify({ text, attachments: state.attachments, bypassThinking: false }),
            });
            state.conversation = data.conversation; state.attachments = [];
            renderAttachments(); input.value = ''; autoGrow(input); renderMessages();
        } catch (e) { toast(String(e.message || e)); } finally {
            state.sending = false; sendBtn.disabled = false; sendBtn.innerHTML = '<i data-lucide="send"></i>';
            if (window.lucide) lucide.createIcons({ root: sendBtn });
        }
    }

    function renderMessages() {
        const box = $('#agentMessages');
        box.innerHTML = '';
        const msgs = (state.conversation && state.conversation.messages) || [];
        msgs.forEach(m => box.appendChild(renderMessage(m)));
        if (window.lucide) lucide.createIcons({ root: box });
        // 延迟滚动确保图片渲染后到底部
        setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    }

    function renderMessage(m) {
        const wrap = document.createElement('div');
        wrap.className = 'agent-msg ' + (m.role === 'user' ? 'user' : 'assistant');
        wrap.dataset.id = m.id;
        if(m.text) {
            const bubble = document.createElement('div');
            bubble.className = 'agent-bubble'; bubble.textContent = m.text;
            wrap.appendChild(bubble);
        }
        if (m.role === 'user' && m.images && m.images.length) {
            const imgRow = document.createElement('div'); imgRow.className = 'agent-msg-images';
            m.images.forEach(img => { const el = document.createElement('img'); el.src = img.url; el.alt = img.name || ''; imgRow.appendChild(el); });
            wrap.appendChild(imgRow);
        }
        if (m.role === 'assistant') {
            if (m.options && m.options.length) wrap.appendChild(renderOptions(m));
            if (m.prompts && m.prompts.length) wrap.appendChild(renderPrompts(m));
            if (m.generations && m.generations.length) wrap.appendChild(renderGenerations(m));
        }
        return wrap;
    }

    function renderOptions(m) {
        const box = document.createElement('div'); box.className = 'agent-options';
        m.options.forEach(opt => {
            const btn = document.createElement('button'); btn.className = 'agent-option-btn'; btn.type = 'button'; btn.textContent = opt.label;
            btn.onclick = () => {
                const input = $('#agentInput'); input.value = opt.value === 'CUSTOM_INPUT' ? '' : opt.value;
                input.focus(); autoGrow(input);
            };
            box.appendChild(btn);
        });
        return box;
    }

    function renderPrompts(m) {
        const box = document.createElement('div'); box.className = 'agent-prompts';
        m.prompts.forEach((p, idx) => {
            const card = document.createElement('div');
            card.className = 'agent-prompt-card' + (p.status === 'current' ? ' current' : '') + (p.status === 'confirmed' ? ' confirmed' : '');
            if (p.status === 'editing') {
                const ta = document.createElement('textarea'); ta.className = 'agent-prompt-edit'; ta.value = p.prompt;
                card.appendChild(ta);
                const actions = document.createElement('div'); actions.className = 'agent-prompt-actions';
                actions.appendChild(mkBtn('保存修改', 'primary', () => savePromptEdit(m.id, idx, ta.value), 'save'));
                actions.appendChild(mkBtn('取消', '', () => cancelPromptEdit(m.id, idx), 'x'));
                card.appendChild(actions);
            } else {
                const text = document.createElement('div'); text.className = 'agent-prompt-text'; text.textContent = p.prompt;
                card.appendChild(text);
                const actions = document.createElement('div'); actions.className = 'agent-prompt-actions';
                if (p.status === 'current' || p.status === 'editing') {
                    actions.appendChild(mkBtn('确认该提示词', 'primary', () => confirmPrompt(m.id, idx), 'check-circle'));
                    actions.appendChild(mkBtn('修改', '', () => editPrompt(m.id, idx), 'edit-2'));
                } else if (p.status === 'confirmed' || p.status === 'skipped') {
                    actions.appendChild(mkBtn('撤销确认', '', () => reopenPrompt(m.id, idx), 'rotate-ccw'));
                }
                card.appendChild(actions);
            }
            box.appendChild(card);
        });
        if (m.prompts.some(p => p.status !== 'confirmed' && p.status !== 'skipped')) {
            const bar = document.createElement('div'); bar.className = 'agent-prompt-actions';
            bar.style.marginTop = '16px'; bar.style.paddingTop = '12px'; bar.style.borderTop = '1px dashed var(--border)';
            bar.appendChild(mkBtn('全部确认并生成', 'primary', () => confirmAllPrompts(m.id), 'zap'));
            bar.appendChild(mkBtn('重新生成当前', '', () => regeneratePrompt(m.id), 'refresh-cw'));
            bar.appendChild(mkBtn('全部取消', 'danger', () => cancelAllPrompts(m.id), 'trash-2'));
            box.appendChild(bar);
        }
        return box;
    }

    // 优化的按钮生成器：支持防抖、Loading状态与图标
    function mkBtn(label, cls, onClick, iconName) {
        const b = document.createElement('button');
        b.type = 'button';
        if (cls) b.className = cls;
        const iconHtml = iconName ? `<i data-lucide="${iconName}" style="width:14px;height:14px;"></i>` : '';
        b.innerHTML = `${iconHtml}<span>${label}</span>`;
        
        b.onclick = async (e) => {
            if (b.disabled) return;
            const origHtml = b.innerHTML;
            b.disabled = true;
            b.innerHTML = `<span class="agent-spinner"></span> <span>处理中</span>`;
            try { await onClick(); } 
            finally {
                if (document.body.contains(b)) {
                    b.disabled = false; b.innerHTML = origHtml;
                    if (window.lucide) lucide.createIcons({ root: b });
                }
            }
        };
        return b;
    }

    function renderGenerations(m) {
        const box = document.createElement('div'); box.className = 'agent-generations';
        m.generations.forEach((g, idx) => {
            const card = document.createElement('div');
            card.className = 'agent-gen-card' + (g.status === 'done' ? ' done' : g.status === 'error' ? ' error' : '');
            if (g.results && g.results.length) {
                g.results.forEach(r => {
                    const img = document.createElement('img'); img.className = 'agent-gen-img'; img.src = r.url;
                    card.appendChild(img);
                });
                const st = document.createElement('div'); st.className = 'agent-gen-status'; st.innerHTML = '<i data-lucide="check-circle" style="width:12px;height:12px;"></i> 完成';
                card.appendChild(st);
            } else {
                const st = document.createElement('div'); st.className = 'agent-gen-status';
                st.innerHTML = (g.status === 'error' ? '<i data-lucide="alert-circle" style="width:12px;height:12px;"></i> ' + (g.error || '失败') : '<span class="agent-spinner"></span> 生成中…');
                card.appendChild(st);
            }
            box.appendChild(card);
        });
        return box;
    }

    async function callPromptAction(path, body) {
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + path, { method: 'POST', body: JSON.stringify(body) });
            state.conversation = data.conversation; renderMessages();
        } catch (e) { toast(String(e.message || e)); }
    }
    const confirmPrompt = (m, i) => callPromptAction('/prompts/confirm', { messageId: m, promptIndex: i });
    const editPrompt = (m, i) => callPromptAction('/prompts/edit', { messageId: m, promptIndex: i });
    const savePromptEdit = (m, i, text) => callPromptAction('/prompts/save-edit', { messageId: m, promptIndex: i, newText: text });
    const cancelPromptEdit = (m, i) => callPromptAction('/prompts/cancel-edit', { messageId: m, promptIndex: i });
    const confirmAllPrompts = (m) => callPromptAction('/prompts/confirm-all', { messageId: m });
    const cancelAllPrompts = (m) => callPromptAction('/prompts/cancel-all', { messageId: m });
    const reopenPrompt = (m, i) => callPromptAction('/prompts/reopen', { messageId: m, promptIndex: i });
    const regeneratePrompt = (m) => callPromptAction('/prompts/regenerate', { messageId: m });

    // --- 状态与提供商 ---
    function syncToolbarFromConv() {
        const c = state.conversation || {};
        if (c.genRatio) $('#agentGenRatio').value = c.genRatio;
        if (c.genResolution) $('#agentGenResolution').value = c.genResolution;
        if (c.genCount) $('#agentGenCount').value = c.genCount;
        if (typeof c.thinkingMode === 'boolean') $('#agentThinkingMode').checked = c.thinkingMode;
        if (c.chatProvider) $('#agentChatProvider').value = c.chatProvider;
        if (c.chatModel) $('#agentChatModel').value = c.chatModel;
        loadProviders();
    }
    function chatProviders() { return (state._providersCache || []).filter(p => p.enabled !== false && (p.chat_models || []).length); }
    function resolveChatProviderId(pid) { const ps = chatProviders(); return ps.some(p => p.id === pid) ? pid : (ps[0] ? ps[0].id : ''); }
    async function loadProviders() {
        try {
            const data = await api('/api/config'); state._providersCache = data.api_providers || [];
            const genProviders = state._providersCache.filter(p => p.enabled !== false && (p.image_models || []).length);
            const gsel = $('#agentGenProvider'); gsel.innerHTML = '';
            genProviders.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name || p.id; gsel.appendChild(o); });
            const gcur = (state.conversation && state.conversation.genProvider) || (genProviders[0] && genProviders[0].id);
            if (gcur) gsel.value = gcur; updateModels(gcur);
            
            const csel = $('#agentChatProvider'); csel.innerHTML = ''; const cps = chatProviders();
            cps.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name || p.id; csel.appendChild(o); });
            const ccur = (state.conversation && state.conversation.chatProvider) || (cps[0] && cps[0].id) || '';
            if (ccur) csel.value = ccur; updateChatModels(ccur);
        } catch (e) { }
    }
    function updateModels(pid) {
        const sel = $('#agentGenModel'); sel.innerHTML = '';
        const prov = (state._providersCache || []).find(p => p.id === pid); const models = (prov && prov.image_models) || [];
        models.forEach(md => { const o = document.createElement('option'); o.value = md; o.textContent = md; sel.appendChild(o); });
        const cur = state.conversation && state.conversation.genModel; if (cur && models.includes(cur)) sel.value = cur;
    }
    function updateChatModels(pid) {
        const sel = $('#agentChatModel'); sel.innerHTML = '';
        const prov = (state._providersCache || []).find(p => p.id === resolveChatProviderId(pid)); const models = (prov && prov.chat_models) || [];
        models.forEach(md => { const o = document.createElement('option'); o.value = md; o.textContent = md; sel.appendChild(o); });
        const cur = state.conversation && state.conversation.chatModel; if (cur && models.includes(cur)) sel.value = cur;
    }
    async function pushSettings() {
        if (!state.conversation) return;
        const settings = {
            genRatio: $('#agentGenRatio').value, genResolution: $('#agentGenResolution').value, genCount: parseInt($('#agentGenCount').value || '1', 10) || 1,
            thinkingMode: $('#agentThinkingMode').checked, chatProvider: $('#agentChatProvider').value, chatModel: $('#agentChatModel').value,
            genProvider: $('#agentGenProvider').value, genModel: $('#agentGenModel').value,
        };
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + '/settings', { method: 'PUT', body: JSON.stringify(settings) });
            state.conversation = data.conversation;
        } catch (e) { toast(String(e.message || e)); }
    }

    // --- 附件上传 ---
    window.addEventListener('agent:add-images', (e) => {
        const imgs = (e && e.detail && e.detail.images) || [];
        if (!Array.isArray(imgs) || !imgs.length) return;
        for (const it of imgs) {
            if (it && it.url && !state.attachments.some(a => a.url === it.url)) state.attachments.push({ url: it.url, name: it.name || 'image' });
        }
        renderAttachments(); if (imgs.length) toast(`已接收 ${imgs.length} 张图至 Agent`);
    });
    function renderAttachments() {
        const box = $('#agentAttachments'); box.innerHTML = '';
        state.attachments.forEach((a, idx) => {
            const thumb = document.createElement('div'); thumb.className = 'agent-attachment-thumb';
            const img = document.createElement('img'); img.src = a.url;
            const x = document.createElement('button'); x.type = 'button'; x.innerHTML = '<i data-lucide="x" style="width:12px;height:12px;"></i>';
            x.onclick = (e) => { e.stopPropagation(); state.attachments.splice(idx, 1); renderAttachments(); };
            thumb.appendChild(img); thumb.appendChild(x); box.appendChild(thumb);
        });
        if (window.lucide) lucide.createIcons({ root: box });
    }
    async function uploadFiles(files) {
        for (const file of files) {
            const fd = new FormData(); fd.append('file', file);
            try {
                const res = await fetch('/api/upload', { method: 'POST', body: fd, headers: { 'X-User-Id': USER_ID } });
                if (res.ok) { const j = await res.json(); const url = j.url || (j.urls && j.urls[0]); if (url) state.attachments.push({ url, name: file.name }); }
            } catch (e) { toast('上传失败: ' + file.name); }
        }
        renderAttachments();
    }

    // --- WebSocket与核心功能 ---
    function connectWS() {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${proto}://${location.host}/ws/agent`);
        state.ws = ws;
        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                if (msg.type === 'agent_gen_done' && state.conversation) {
                    refreshActiveConversation();
                }
            } catch (e) {}
        };
        ws.onclose = () => { setTimeout(connectWS, 2000); };
        ws.onerror = () => { try { ws.close(); } catch (e) {} };
    }
    async function refreshActiveConversation() {
        if (!state.activeId) return;
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId));
            state.conversation = data.conversation; renderMessages();
        } catch (e) {}
    }
    async function recoverGenerations() {
        if (!state.activeId) return;
        try {
            const btn = $('#agentRecoverBtn');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<span class="agent-spinner" style="width:16px;height:16px;"></span>';
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + '/recover', { method: 'POST' });
            state.conversation = data.conversation; renderMessages(); toast('已尝试恢复生图任务');
            setTimeout(() => { btn.innerHTML = origHTML; if (window.lucide) lucide.createIcons({root: btn}); }, 500);
        } catch (e) { toast(String(e.message || e)); }
    }

    function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px'; }

    function bindEvents() {
        $('#agentSendBtn').onclick = sendMessage; $('#agentNewChatBtn').onclick = newConversation; $('#agentRecoverBtn').onclick = recoverGenerations;
        $('#agentSidebarToggle').onclick = () => $('#agentSidebar').classList.toggle('open');
        const input = $('#agentInput'); input.addEventListener('input', () => autoGrow(input));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        $('#agentUploadBtn').onclick = () => $('#agentFileInput').click();
        $('#agentFileInput').addEventListener('change', (e) => { if (e.target.files && e.target.files.length) uploadFiles(e.target.files); e.target.value = ''; });
        $('#agentGenProvider').onchange = () => { updateModels($('#agentGenProvider').value); pushSettings(); };
        $('#agentGenModel').onchange = pushSettings;
        $('#agentChatProvider').onchange = () => { updateChatModels($('#agentChatProvider').value); pushSettings(); };
        $('#agentChatModel').onchange = pushSettings;
        $('#agentGenRatio').onchange = pushSettings; $('#agentGenResolution').onchange = pushSettings;
        $('#agentGenCount').onchange = pushSettings; $('#agentThinkingMode').onchange = pushSettings;
    }

    async function init() {
        bindEvents(); connectWS();
        if (window.lucide) lucide.createIcons();
        try { await loadConversations(); } catch (e) { toast('加载对话失败: ' + String(e.message || e)); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

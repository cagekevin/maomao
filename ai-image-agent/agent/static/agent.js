/* Agent 独立页面前端逻辑（解耦自 smart-canvas.js，独立文件 T5）
 * 对接 agent_backend.py 的 REST API + /ws/agent WebSocket。
 * 纪律：结果只来自后端会话，绝不回写画布（T3）。 */
(function () {
    'use strict';

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    // ---- user id（跨页面共享，发 X-User-Id）----
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

    // ---- 全局状态 ----
    const state = {
        conversations: [],
        activeId: '',
        conversation: null,
        attachments: [],
        sending: false,
        ws: null,
    };

    // ---- API 工具 ----
    async function api(path, opts) {
        opts = opts || {};
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
        // 轻量提示：创建临时元素
        let t = $('#agentToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'agentToast';
            t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;z-index:99;max-width:80%;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.display = 'block';
        clearTimeout(t._timer);
        t._timer = setTimeout(() => { t.style.display = 'none'; }, 2600);
    }

    // ---- 会话管理 ----
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
            state.activeId = '';
            state.conversation = null;
            if (state.conversations.length) await openConversation(state.conversations[0].id);
            else await newConversation();
        }
        renderChatList();
    }

    function renderChatList() {
        const list = $('#agentChatList');
        list.innerHTML = '';
        if (!state.conversations.length) {
            list.innerHTML = '<div class="agent-chat-empty">暂无对话</div>';
            return;
        }
        state.conversations.forEach(conv => {
            const btn = document.createElement('button');
            btn.className = 'agent-chat-item' + (conv.id === state.activeId ? ' active' : '');
            btn.type = 'button';
            btn.dataset.id = conv.id;
            const title = document.createElement('span');
            title.className = 'agent-chat-item-title';
            title.textContent = conv.title || '对话';
            const time = document.createElement('span');
            time.className = 'agent-chat-item-time';
            time.textContent = conv.updated_at ? new Date(conv.updated_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '';
            const del = document.createElement('button');
            del.className = 'agent-chat-item-delete';
            del.type = 'button';
            del.innerHTML = '<i data-lucide="x"></i>';
            del.onclick = (e) => { e.stopPropagation(); if (confirm('删除该对话？')) deleteConversation(conv.id); };
            btn.appendChild(title); btn.appendChild(time); btn.appendChild(del);
            btn.onclick = () => openConversation(conv.id);
            list.appendChild(btn);
        });
        if (window.lucide) lucide.createIcons();
    }

    function updateTitle() {
        $('#agentConvTitle').textContent = (state.conversation && state.conversation.title) || '新对话';
    }

    // ---- 发送消息 ----
    async function sendMessage() {
        if (state.sending || !state.conversation) return;
        const input = $('#agentInput');
        const text = input.value.trim();
        if (!text && !state.attachments.length) return;
        state.sending = true;
        $('#agentSendBtn').disabled = true;
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + '/messages', {
                method: 'POST',
                body: JSON.stringify({ text, attachments: state.attachments, bypassThinking: false }),
            });
            state.conversation = data.conversation;
            state.attachments = [];
            renderAttachments();
            input.value = '';
            autoGrow(input);
            renderMessages();
        } catch (e) {
            toast(String(e.message || e));
        } finally {
            state.sending = false;
            $('#agentSendBtn').disabled = false;
        }
    }

    // ---- 渲染消息 ----
    function renderMessages() {
        const box = $('#agentMessages');
        box.innerHTML = '';
        const msgs = (state.conversation && state.conversation.messages) || [];
        msgs.forEach(m => box.appendChild(renderMessage(m)));
        box.scrollTop = box.scrollHeight;
        if (window.lucide) lucide.createIcons();
    }

    function renderMessage(m) {
        const wrap = document.createElement('div');
        wrap.className = 'agent-msg ' + (m.role === 'user' ? 'user' : 'assistant');
        wrap.dataset.id = m.id;
        const bubble = document.createElement('div');
        bubble.className = 'agent-bubble';
        bubble.textContent = m.text || '';
        wrap.appendChild(bubble);
        if (m.role === 'user' && m.images && m.images.length) {
            const imgRow = document.createElement('div');
            imgRow.className = 'agent-msg-images';
            m.images.forEach(img => {
                const el = document.createElement('img');
                el.src = img.url; el.alt = img.name || '';
                imgRow.appendChild(el);
            });
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
        const box = document.createElement('div');
        box.className = 'agent-options';
        m.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'agent-option-btn';
            btn.type = 'button';
            btn.textContent = opt.label;
            btn.onclick = () => {
                const input = $('#agentInput');
                input.value = opt.value === 'CUSTOM_INPUT' ? '' : opt.value;
                input.focus();
                autoGrow(input);
            };
            box.appendChild(btn);
        });
        return box;
    }

    function renderPrompts(m) {
        const box = document.createElement('div');
        box.className = 'agent-prompts';
        m.prompts.forEach((p, idx) => {
            const card = document.createElement('div');
            card.className = 'agent-prompt-card' + (p.status === 'current' ? ' current' : '') + (p.status === 'confirmed' ? ' confirmed' : '');
            if (p.status === 'editing') {
                const ta = document.createElement('textarea');
                ta.className = 'agent-prompt-edit';
                ta.value = p.prompt;
                ta.dataset.promptEdit = '1';
                card.appendChild(ta);
                const actions = document.createElement('div');
                actions.className = 'agent-prompt-actions';
                actions.appendChild(mkBtn('保存', 'primary', () => savePromptEdit(m.id, idx, ta.value)));
                actions.appendChild(mkBtn('取消', '', () => cancelPromptEdit(m.id, idx)));
                card.appendChild(actions);
            } else {
                const text = document.createElement('div');
                text.className = 'agent-prompt-text';
                text.textContent = p.prompt;
                card.appendChild(text);
                const actions = document.createElement('div');
                actions.className = 'agent-prompt-actions';
                if (p.status === 'current' || p.status === 'editing') {
                    actions.appendChild(mkBtn('确认', 'primary', () => confirmPrompt(m.id, idx)));
                    actions.appendChild(mkBtn('修改', '', () => editPrompt(m.id, idx)));
                } else if (p.status === 'confirmed' || p.status === 'skipped') {
                    actions.appendChild(mkBtn('改回', '', () => reopenPrompt(m.id, idx)));
                }
                card.appendChild(actions);
            }
            box.appendChild(card);
        });
        if (m.prompts.some(p => p.status !== 'confirmed' && p.status !== 'skipped')) {
            const bar = document.createElement('div');
            bar.className = 'agent-prompt-actions';
            bar.appendChild(mkBtn('全部确认并生成', 'primary', () => confirmAllPrompts(m.id)));
            bar.appendChild(mkBtn('全部取消', '', () => cancelAllPrompts(m.id)));
            bar.appendChild(mkBtn('重新生成当前', '', () => regeneratePrompt(m.id)));
            box.appendChild(bar);
        }
        return box;
    }

    function mkBtn(label, cls, onClick) {
        const b = document.createElement('button');
        b.type = 'button';
        if (cls) b.className = cls;
        b.textContent = label;
        b.onclick = onClick;
        return b;
    }

    function renderGenerations(m) {
        const box = document.createElement('div');
        box.className = 'agent-generations';
        m.generations.forEach((g, idx) => {
            const card = document.createElement('div');
            card.className = 'agent-gen-card' + (g.status === 'done' ? ' done' : g.status === 'error' ? ' error' : '');
            card.dataset.genIdx = idx;
            if (g.results && g.results.length) {
                g.results.forEach(r => {
                    const img = document.createElement('img');
                    img.className = 'agent-gen-img';
                    img.src = r.url; img.alt = r.name || '';
                    card.appendChild(img);
                });
                const st = document.createElement('div');
                st.className = 'agent-gen-status';
                st.textContent = '✓ 完成';
                card.appendChild(st);
            } else {
                const st = document.createElement('div');
                st.className = 'agent-gen-status';
                st.innerHTML = '<span class="agent-spinner"></span>' + (g.status === 'error' ? ('✗ ' + (g.error || '失败')) : '生成中…');
                card.appendChild(st);
            }
            box.appendChild(card);
        });
        return box;
    }

    // ---- prompt 状态机调用 ----
    async function confirmPrompt(msgId, idx) {
        await callPromptAction('/prompts/confirm', { messageId: msgId, promptIndex: idx });
    }
    async function editPrompt(msgId, idx) {
        await callPromptAction('/prompts/edit', { messageId: msgId, promptIndex: idx });
    }
    async function savePromptEdit(msgId, idx, newText) {
        await callPromptAction('/prompts/save-edit', { messageId: msgId, promptIndex: idx, newText });
    }
    async function cancelPromptEdit(msgId, idx) {
        await callPromptAction('/prompts/cancel-edit', { messageId: msgId, promptIndex: idx });
    }
    async function confirmAllPrompts(msgId) {
        await callPromptAction('/prompts/confirm-all', { messageId: msgId });
    }
    async function cancelAllPrompts(msgId) {
        await callPromptAction('/prompts/cancel-all', { messageId: msgId });
    }
    async function reopenPrompt(msgId, idx) {
        await callPromptAction('/prompts/reopen', { messageId: msgId, promptIndex: idx });
    }
    async function regeneratePrompt(msgId) {
        await callPromptAction('/prompts/regenerate', { messageId: msgId });
    }
    async function callPromptAction(path, body) {
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + path, {
                method: 'POST', body: JSON.stringify(body),
            });
            state.conversation = data.conversation;
            renderMessages();
        } catch (e) {
            toast(String(e.message || e));
        }
    }

    // ---- 工具栏 / 设置 ----
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
    // 理解模型（思维模式）provider/model —— 对齐作者 chatApiProviders/resolveChatProviderId/resolveChatModel
    function chatProviders() {
        return (state._providersCache || []).filter(p => p.enabled !== false && (p.chat_models || []).length);
    }
    function resolveChatProviderId(pid) {
        const ps = chatProviders();
        if (ps.some(p => p.id === pid)) return pid;
        return ps[0] ? ps[0].id : '';
    }
    function resolveChatModel(model, pid) {
        const ps = chatProviders();
        const prov = ps.find(p => p.id === resolveChatProviderId(pid)) || ps[0];
        const models = (prov && prov.chat_models) || [];
        return models.includes(model) ? model : (models[0] || model || '');
    }
    async function loadProviders() {
        try {
            const data = await api('/api/config');
            const genProviders = (data.api_providers || []).filter(p => p.enabled !== false && (p.image_models || []).length);
            state._providersCache = data.api_providers || [];
            // 生图 provider/model
            const gsel = $('#agentGenProvider');
            gsel.innerHTML = '';
            genProviders.forEach(p => {
                const o = document.createElement('option');
                o.value = p.id; o.textContent = p.name || p.id;
                gsel.appendChild(o);
            });
            const gcur = (state.conversation && state.conversation.genProvider) || (genProviders[0] && genProviders[0].id);
            if (gcur) gsel.value = gcur;
            updateModels(gcur);
            // 理解模型 provider/model（v1.6 思维模式下拉）
            const csel = $('#agentChatProvider');
            csel.innerHTML = '';
            const cps = chatProviders();
            cps.forEach(p => {
                const o = document.createElement('option');
                o.value = p.id; o.textContent = p.name || p.id;
                csel.appendChild(o);
            });
            const ccur = (state.conversation && state.conversation.chatProvider) || (cps[0] && cps[0].id) || '';
            if (ccur) csel.value = ccur;
            updateChatModels(ccur);
        } catch (e) { /* 配置接口失败不影响主流程 */ }
    }
    function updateModels(providerId) {
        const sel = $('#agentGenModel');
        sel.innerHTML = '';
        const prov = (state._providersCache || []).find(p => p.id === providerId);
        const models = (prov && prov.image_models) || [];
        models.forEach(md => {
            const o = document.createElement('option');
            o.value = md; o.textContent = md;
            sel.appendChild(o);
        });
        const cur = state.conversation && state.conversation.genModel;
        if (cur && models.includes(cur)) sel.value = cur;
    }
    function updateChatModels(providerId) {
        const sel = $('#agentChatModel');
        sel.innerHTML = '';
        const prov = (state._providersCache || []).find(p => p.id === resolveChatProviderId(providerId));
        const models = (prov && prov.chat_models) || [];
        models.forEach(md => {
            const o = document.createElement('option');
            o.value = md; o.textContent = md;
            sel.appendChild(o);
        });
        const cur = state.conversation && state.conversation.chatModel;
        if (cur && models.includes(cur)) sel.value = cur;
    }
    async function pushSettings() {
        if (!state.conversation) return;
        const settings = {
            genRatio: $('#agentGenRatio').value,
            genResolution: $('#agentGenResolution').value,
            genCount: parseInt($('#agentGenCount').value || '1', 10) || 1,
            thinkingMode: $('#agentThinkingMode').checked,
            chatProvider: $('#agentChatProvider').value,
            chatModel: $('#agentChatModel').value,
            genProvider: $('#agentGenProvider').value,
            genModel: $('#agentGenModel').value,
        };
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + '/settings', {
                method: 'PUT', body: JSON.stringify(settings),
            });
            state.conversation = data.conversation;
        } catch (e) { toast(String(e.message || e)); }
    }

    // ---- 附件 ----
    // 同页联动：画布侧「发送至Agent」经 CustomEvent('agent:add-images') 推图（C4-2，不读画布 nodes，T3）
    window.addEventListener('agent:add-images', (e) => {
        const imgs = (e && e.detail && e.detail.images) || [];
        if (!Array.isArray(imgs) || !imgs.length) return;
        for (const it of imgs) {
            if (it && it.url && !state.attachments.some(a => a.url === it.url)) {
                state.attachments.push({ url: it.url, name: it.name || 'image' });
            }
        }
        renderAttachments();
        if (imgs.length) toast(`已接收 ${imgs.length} 张图至 Agent`);
    });
    function renderAttachments() {
        const box = $('#agentAttachments');
        box.innerHTML = '';
        state.attachments.forEach((a, idx) => {
            const thumb = document.createElement('div');
            thumb.className = 'agent-attachment-thumb';
            thumb.draggable = state.attachments.length > 1;
            thumb.dataset.agentAttIndex = String(idx);
            const img = document.createElement('img');
            img.src = a.url; img.alt = a.name || '';
            const x = document.createElement('button');
            x.type = 'button'; x.textContent = '×';
            x.dataset.agentAttRemove = String(idx);
            x.onclick = (e) => { e.stopPropagation(); state.attachments.splice(idx, 1); renderAttachments(); };
            thumb.appendChild(img); thumb.appendChild(x);
            box.appendChild(thumb);
            // 拖拽排序（对齐作者 renderAgentAttachments 的拖拽逻辑，去掉画布跳转）
            thumb.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                thumb.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
            });
            thumb.addEventListener('dragend', () => {
                thumb.classList.remove('dragging');
                box.querySelectorAll('.agent-attachment-thumb').forEach(c => c.classList.remove('drop-before', 'drop-after'));
            });
            thumb.addEventListener('dragover', (e) => {
                const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (!Number.isFinite(fromIdx) || fromIdx < 0 || fromIdx === toIdx) return;
                e.preventDefault(); e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                box.querySelectorAll('.agent-attachment-thumb').forEach(c => c.classList.remove('drop-before', 'drop-after'));
                const rect = thumb.getBoundingClientRect();
                const placement = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                thumb.classList.add(placement === 'before' ? 'drop-before' : 'drop-after');
            });
            thumb.addEventListener('dragleave', (e) => {
                if (thumb.contains(e.relatedTarget)) return;
                thumb.classList.remove('drop-before', 'drop-after');
            });
            thumb.addEventListener('drop', (e) => {
                const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                const toIdx = idx;
                if (!Number.isFinite(fromIdx) || fromIdx < 0 || fromIdx === toIdx) return;
                e.preventDefault(); e.stopPropagation();
                box.querySelectorAll('.agent-attachment-thumb').forEach(c => c.classList.remove('drop-before', 'drop-after'));
                const rect = thumb.getBoundingClientRect();
                const placement = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                const atts = state.attachments.slice();
                const [moved] = atts.splice(fromIdx, 1);
                let insertAt = toIdx;
                if (placement === 'after') insertAt += 1;
                if (fromIdx < insertAt) insertAt -= 1;
                atts.splice(Math.max(0, Math.min(atts.length, insertAt)), 0, moved);
                state.attachments = atts;
                renderAttachments();
            });
        });
    }
    async function uploadFiles(files) {
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            try {
                const res = await fetch('/api/upload', { method: 'POST', body: fd, headers: { 'X-User-Id': USER_ID } });
                if (res.ok) {
                    const j = await res.json();
                    const url = j.url || (j.urls && j.urls[0]);
                    if (url) state.attachments.push({ url, name: file.name });
                }
            } catch (e) { toast('上传失败: ' + file.name); }
        }
        renderAttachments();
    }

    // ---- WebSocket 实时刷新 ----
    function connectWS() {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${proto}://${location.host}/ws/agent`);
        state.ws = ws;
        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                if (msg.type === 'agent_gen_done' && state.conversation) {
                    state.conversation = state.conversation; // 触发重新拉取
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
            state.conversation = data.conversation;
            renderMessages();
        } catch (e) {}
    }

    async function recoverGenerations() {
        if (!state.activeId) return;
        try {
            const data = await api('/api/agent/conversations/' + encodeURIComponent(state.activeId) + '/recover', { method: 'POST' });
            state.conversation = data.conversation;
            renderMessages();
            toast('已尝试恢复中断的生图');
        } catch (e) { toast(String(e.message || e)); }
    }

    // ---- 输入自适应 ----
    function autoGrow(el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }

    // ---- 事件绑定 ----
    function bindEvents() {
        $('#agentSendBtn').onclick = sendMessage;
        $('#agentNewChatBtn').onclick = newConversation;
        $('#agentRecoverBtn').onclick = recoverGenerations;
        $('#agentSidebarToggle').onclick = () => $('#agentSidebar').classList.toggle('open');
        const input = $('#agentInput');
        input.addEventListener('input', () => autoGrow(input));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
        $('#agentUploadBtn').onclick = () => $('#agentFileInput').click();
        $('#agentFileInput').addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length) uploadFiles(e.target.files);
            e.target.value = '';
        });
        $('#agentGenProvider').onchange = () => { updateModels($('#agentGenProvider').value); pushSettings(); };
        $('#agentGenModel').onchange = pushSettings;
        $('#agentChatProvider').onchange = () => { updateChatModels($('#agentChatProvider').value); pushSettings(); };
        $('#agentChatModel').onchange = pushSettings;
        $('#agentGenRatio').onchange = pushSettings;
        $('#agentGenResolution').onchange = pushSettings;
        $('#agentGenCount').onchange = pushSettings;
        $('#agentThinkingMode').onchange = pushSettings;
    }

    // ---- 启动 ----
    async function init() {
        bindEvents();
        connectWS();
        try {
            await loadConversations();
        } catch (e) {
            toast('加载对话失败: ' + String(e.message || e));
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

// data.js - Modulo compartilhado: GitHub API sync + localStorage fallback
const OM_ORDER = [
    "Bda Inf Amv (OI)","Cia C Bda Inf Amv","2Ã‚Âº BI Amv","5Ã‚Âº BI Amv","6Ã‚Âº BI Amv",
    "5Ã‚Âª Bia AAAe Amv","20Ã‚Âº GAC Amv","12Ã‚Âª Cia Com Amv","12Ã‚Âª Cia E Cmb Amv",
    "12Ã‚Âº Pel PE Amv","22Ã‚Âº B Log Amv","1Ã‚Âº Esqd C Amv"
];
const LS_KEY = 'controleMaterial';
const TOKEN_KEY = 'github_token';
let _data = [];
let _githubSha = null;
let _autoRefreshTimer = null;
let _lastUpdate = null;

function _getOmOrder(om) { const i = OM_ORDER.indexOf(om); return i >= 0 ? i : 999; }
function sortData(arr) { return [...arr].sort((a, b) => _getOmOrder(a.om) - _getOmOrder(b.om)); }
function getNextId(data) { return data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1; }

async function loadData() {
    const fresh = await fetchGitHubData();
    if (fresh && fresh.length > 0) {
        _data = fresh;
        localStorage.setItem(LS_KEY, JSON.stringify(fresh));
        return _data;
    }
    _data = await fetchLocalData();
    if (!_data || _data.length === 0) {
        await fetchDefaultData();
    }
    return _data;
}

function getData() { return _data; }

async function saveData(data) {
    _data = data;
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    await saveGitHubData(data);
}

// ============ GitHub API ============
function _isConfigured() {
    const t = _getToken();
    return t && t !== 'COLE_SEU_TOKEN_AQUI' && t.length > 10;
}

function _getToken() {
    if (typeof GITHUB_CONFIG !== 'undefined' && GITHUB_CONFIG.token) return GITHUB_CONFIG.token;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
        if (typeof GITHUB_CONFIG !== 'undefined') GITHUB_CONFIG.token = stored;
        return stored;
    }
    return '';
}

async function fetchGitHubData() {
    try {
        const timestamp = Date.now();
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}?t=${timestamp}`;
        const headers = { 'Accept': 'application/vnd.github.v3+json' };
        const t = _getToken();
        if (t && t.length > 10) headers['Authorization'] = `token ${t}`;
        const resp = await fetch(url, { cache: 'no-store', headers });
        if (!resp.ok) return null;
        const json = await resp.json();
        _githubSha = json.sha;
        const content = decodeURIComponent(escape(atob(json.content)));
        const parsed = JSON.parse(content);
        localStorage.setItem(LS_KEY, JSON.stringify(parsed));
        _lastUpdate = new Date();
        localStorage.setItem('lastUpdate', _lastUpdate.toISOString());
        return parsed;
    } catch (e) {
        console.error('GitHub fetch error:', e);
        return null;
    }
}

async function saveGitHubData(data) {
    if (!_isConfigured()) return false;
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}`;
        const body = { message: `Atualizado via Controle de Material - ${new Date().toLocaleString('pt-BR')}`, content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))), branch: 'master' };
        if (_githubSha) body.sha = _githubSha;
        const resp = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${_getToken()}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
            body: JSON.stringify(body)
        });
        if (resp.ok) {
            const json = await resp.json();
            _githubSha = json.content.sha;
            return true;
        }
        return false;
    } catch (e) {
        console.error('GitHub save error:', e);
        return false;
    }
}

// ============ localStorage ============
async function fetchLocalData() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {}
    return null;
}

// ============ dados padrao (fallback) ============
async function fetchDefaultData() {
    try {
        const resp = await fetch('data.json');
        if (resp.ok) {
            const parsed = await resp.json();
            if (Array.isArray(parsed) && parsed.length > 0) {
                _data = parsed;
                localStorage.setItem(LS_KEY, JSON.stringify(parsed));
                await saveGitHubData(parsed);
                return parsed;
            }
        }
    } catch (e) {}
    return null;
}

// ============ auto refresh ============
function startAutoRefresh(intervalMs) {
    if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
    const interval = intervalMs || 10000;
    _autoRefreshTimer = setInterval(async () => {
        try {
            const fresh = await fetchGitHubData();
            if (fresh && fresh.length > 0) {
                const oldJson = JSON.stringify(_data);
                const newJson = JSON.stringify(fresh);
                if (oldJson !== newJson) {
                    _data = fresh;
                    if (typeof renderTable === 'function') renderTable();
                    if (typeof renderAll === 'function') renderAll(_data);
                    updateLastUpdateDisplay();
                    showSyncStatus('Atualizado automaticamente!', 'ok');
                } else {
                    showSyncStatus('Online - atualizado', 'ok');
                }
            }
        } catch (e) {
            console.error('Auto-refresh error:', e);
        }
    }, interval);
}

// ============ UI helpers ============
function showSyncStatus(msg, type) {
    let el = document.getElementById('syncStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'ok' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--text-muted)';
}

async function manualRefresh() {
    showSyncStatus('Sincronizando...', '');
    const fresh = await fetchGitHubData();
    if (fresh && fresh.length > 0) {
        _data = fresh;
        showSyncStatus('Sincronizado!', 'ok');
        updateLastUpdateDisplay();
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderAll === 'function') renderAll(_data);
    } else {
        showSyncStatus('Sem conexao - dados locais', '');
    }
}

function formatDate() {
    const today = new Date();
    return today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getLastUpdate() {
    if (_lastUpdate) return _lastUpdate.toLocaleString('pt-BR');
    const stored = localStorage.getItem('lastUpdate');
    if (stored) return new Date(stored).toLocaleString('pt-BR');
    return 'Nunca';
}

function updateLastUpdateDisplay() {
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = getLastUpdate();
}

function setGitHubToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
    if (typeof GITHUB_CONFIG !== 'undefined') GITHUB_CONFIG.token = token;
    console.log('Token configurado! Recarregue a pagina para aplicar.');
}

// Token prompt removido - funcionalidade local sem necessidade de token

// ============ Splash / Pagina Rosto ============
const SPLASH_KEY = 'splash_auth';
const SPLASH_PASS = '4secamv';

function initSplash() {
    if (sessionStorage.getItem(SPLASH_KEY) === '1') return;
    const overlay = document.createElement('div');
    overlay.className = 'splash-overlay';
    overlay.id = 'splashOverlay';
    overlay.innerHTML = `
        <div class="splash-card">
            <img src="logo-rosto.png" alt="Logo" class="splash-logo">
            <div class="splash-title">Controle de Material</div>
            <div class="splash-subtitle">Bda Inf Amv</div>
            <div class="splash-input-group">
                <input type="password" class="splash-input" id="splashPassword" placeholder="Digite a senha" autofocus>
                <button class="splash-btn" id="splashBtn">Entrar</button>
            </div>
            <div class="splash-error" id="splashError"></div>
        </div>
        <div class="splash-footer">Sistema de Controle de Material Militar</div>
    `;
    document.body.appendChild(overlay);
    const btn = document.getElementById('splashBtn');
    const input = document.getElementById('splashPassword');
    const error = document.getElementById('splashError');
    function tryLogin() {
        if (input.value === SPLASH_PASS) {
            sessionStorage.setItem(SPLASH_KEY, '1');
            overlay.classList.add('hidden');
            setTimeout(() => overlay.remove(), 600);
        } else {
            error.textContent = 'Senha incorreta!';
            input.value = '';
            input.focus();
            input.style.borderColor = '#c0392b';
            setTimeout(() => input.style.borderColor = '', 1500);
        }
    }
    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
}

function isSplashAuth() {
    return sessionStorage.getItem(SPLASH_KEY) === '1';
}

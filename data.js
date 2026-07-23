// data.js - Modulo compartilhado: GitHub API sync + localStorage fallback
const OM_ORDER = [
    "Bda Inf Amv (OI)","Cia C Bda Inf Amv","2º BI Amv","5º BI Amv","6º BI Amv",
    "5ª Bia AAAe Amv","20º GAC Amv","12ª Cia Com Amv","12ª Cia E Cmb Amv",
    "12º Pel PE Amv","22º B Log Amv","1º Esqd C Amv"
];
const LS_KEY = 'controleMaterial';
let _data = [];
let _githubSha = null;

function _getOmOrder(om) { const i = OM_ORDER.indexOf(om); return i >= 0 ? i : 999; }
function sortData(arr) { return [...arr].sort((a, b) => _getOmOrder(a.om) - _getOmOrder(b.om)); }
function getNextId(data) { return data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1; }

async function loadData() {
    _data = await fetchGitHubData();
    if (!_data || _data.length === 0) {
        _data = await fetchLocalData();
        if (!_data || _data.length === 0) {
            await fetchDefaultData();
        }
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
    return typeof GITHUB_CONFIG !== 'undefined' &&
           GITHUB_CONFIG.token &&
           GITHUB_CONFIG.token !== 'COLE_SEU_TOKEN_AQUI';
}

async function fetchGitHubData() {
    if (!_isConfigured()) return null;
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}`;
        const resp = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_CONFIG.token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!resp.ok) return null;
        const json = await resp.json();
        _githubSha = json.sha;
        const content = decodeURIComponent(escape(atob(json.content)));
        const parsed = JSON.parse(content);
        localStorage.setItem(LS_KEY, JSON.stringify(parsed));
        return parsed;
    } catch (e) {
        console.error('GitHub fetch error:', e);
        return null;
    }
}

async function saveGitHubData(data) {
    if (!_isConfigured()) return;
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}`;
        const body = { message: `Atualizado via Controle de Material - ${new Date().toLocaleString('pt-BR')}`, content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))), branch: 'master' };
        if (_githubSha) body.sha = _githubSha;
        const resp = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${GITHUB_CONFIG.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
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
        if (typeof renderTable === 'function') renderTable();
        if (typeof renderAll === 'function') renderAll();
    } else {
        showSyncStatus('Sem conexao - dados locais', '');
    }
}

function formatDate() {
    const today = new Date();
    return today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function setGitHubToken(token) {
    localStorage.setItem('github_token', token);
    GITHUB_CONFIG.token = token;
    console.log('Token configurado! Recarregue a pagina para aplicar.');
}

if (!GITHUB_CONFIG.token) {
    console.log('GitHub token nao configurado. Execute: setGitHubToken("SEU_TOKEN")');
}

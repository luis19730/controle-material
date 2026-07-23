// GitHub API - Personal Access Token (repo scope)
// Criar em: https://github.com/settings/tokens
// Permissoes necessarias: repo (Control private repositories)
const GITHUB_CONFIG = {
    owner: 'luis19730',
    repo: 'controle-material',
    token: localStorage.getItem('github_token') || '',
    dataFile: 'data.json'
};

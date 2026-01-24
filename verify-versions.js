const fs = require('fs');
const path = require('path');

const COLORS = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

function fail(msg) {
    console.error(`${COLORS.red}❌ ERROR: ${msg}${COLORS.reset}`);
    process.exit(1);
}

function success(msg) {
    console.log(`${COLORS.green}✅ ${msg}${COLORS.reset}`);
}

function info(msg) {
    console.log(`${COLORS.yellow}ℹ️ ${msg}${COLORS.reset}`);
}

console.log(`${COLORS.yellow}🔍 Verificando consistencia de versiones...${COLORS.reset}`);

// 1. Read Truth (version.json)
const versionPath = path.join(__dirname, 'version.json');
if (!fs.existsSync(versionPath)) fail('version.json no encontrado');
const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
const TARGET_VERSION = versionData.version;

info(`Versión objetivo detectada en version.json: v${TARGET_VERSION}`);

// 2. Check js/app.js
const appJsPath = path.join(__dirname, 'js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const appVersionMatch = appJsContent.match(/const APP_VERSION = (\d+);/);

if (!appVersionMatch) fail('No se encontró APP_VERSION en js/app.js');
const appVersion = parseInt(appVersionMatch[1]);

if (appVersion !== TARGET_VERSION) {
    fail(`Discrepancia en js/app.js: Se esperaba ${TARGET_VERSION}, se encontró ${appVersion}`);
} else {
    success(`js/app.js coincide (v${appVersion})`);
}

// 3. Check sw.js
const swPath = path.join(__dirname, 'sw.js');
const swContent = fs.readFileSync(swPath, 'utf8');
const swCacheMatch = swContent.match(/const CACHE_NAME = ['"]inmogestor-pro-v(\d+)['"];/);
const swUrlMatch = swContent.match(/\?v=(\d+)/); // Check at least one query param

if (!swCacheMatch) fail('No se encontró CACHE_NAME en sw.js');
const swVersion = parseInt(swCacheMatch[1]);

if (swVersion !== TARGET_VERSION) {
    fail(`Discrepancia en sw.js (CACHE_NAME): Se esperaba ${TARGET_VERSION}, se encontró ${swVersion}`);
} else {
    success(`sw.js CACHE_NAME coincide (v${swVersion})`);
}

if (swUrlMatch && parseInt(swUrlMatch[1]) !== TARGET_VERSION) {
    fail(`Discrepancia en sw.js (URLs): Se encontró ?v=${swUrlMatch[1]}, se esperaba ?v=${TARGET_VERSION}`);
}

// 4. Check index.html
const indexPath = path.join(__dirname, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');
// Check for at least one critical file having the version
const indexMatch = indexContent.match(/js\/app\.js\?v=(\d+)/);

if (!indexMatch) fail('No se encontró referencia versionada a js/app.js en index.html');
const indexVersion = parseInt(indexMatch[1]);

if (indexVersion !== TARGET_VERSION) {
    fail(`Discrepancia en index.html: Se encontró ?v=${indexVersion}, se esperaba ?v=${TARGET_VERSION}`);
} else {
    success(`index.html referencias coinciden (v${indexVersion})`);
}

success('¡Todas las versiones están sincronizadas!');
process.exit(0);

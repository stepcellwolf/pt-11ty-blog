import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let Database = null;
let sqliteAvailable = false;
let loadError = null;
async function tryLoadSQLite() {
    try {
        const require = createRequire(import.meta.url);
        Database = require('better-sqlite3');
        sqliteAvailable = true;
        return true;
    } catch (requireErr) {
        try {
            const module = await import('better-sqlite3');
            Database = module.default;
            sqliteAvailable = true;
            return true;
        } catch (importErr) {
            loadError = importErr;
            const isVersionMismatch = requireErr.message?.includes('NODE_MODULE_VERSION') || importErr.message?.includes('NODE_MODULE_VERSION') || requireErr.message?.includes('was compiled against a different Node.js version') || importErr.message?.includes('was compiled against a different Node.js version');
            if (isVersionMismatch) {
                const errorMsg = requireErr.message || importErr.message || '';
                const compiledMatch = errorMsg.match(/NODE_MODULE_VERSION (\d+)/);
                const requiredMatch = errorMsg.match(/requires\s+NODE_MODULE_VERSION (\d+)/);
                const nodeVersionMap = {
                    '108': '18.x',
                    '115': '20.x',
                    '120': '21.x',
                    '127': '22.x',
                    '131': '23.x'
                };
                let versionInfo = '';
                if (compiledMatch && requiredMatch) {
                    const compiled = nodeVersionMap[compiledMatch[1]] || `ABI ${compiledMatch[1]}`;
                    const required = nodeVersionMap[requiredMatch[1]] || `ABI ${requiredMatch[1]}`;
                    versionInfo = `\n║  Module compiled for Node.js ${compiled}, running Node.js ${required}`.padEnd(79) + '║';
                }
                console.warn(`
╔══════════════════════════════════════════════════════════════════════════════╗
║              Native Module Version Mismatch (NODE_MODULE_VERSION)            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  The better-sqlite3 module was compiled for a different Node.js version.    ║${versionInfo}
║                                                                              ║
║  Claude Flow will continue with JSON fallback storage (still works fine).   ║
║                                                                              ║
║  To fix this and use SQLite:                                                 ║
║                                                                              ║
║  Option 1 - Rebuild the module:                                              ║
║  > npm rebuild better-sqlite3                                                ║
║                                                                              ║
║  Option 2 - Clear npx cache (if using npx):                                  ║
║  > rm -rf ~/.npm/_npx/ && npx claude-flow@alpha ...                         ║
║                                                                              ║
║  Option 3 - Reinstall dependencies:                                         ║
║  > rm -rf node_modules && npm install                                        ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
                return false;
            }
            if (requireErr.message?.includes('Could not locate the bindings file') || requireErr.message?.includes('The specified module could not be found') || requireErr.code === 'MODULE_NOT_FOUND') {
                console.warn(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     SQLite Native Module Installation Issue                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  The native SQLite module failed to load. This is common on Windows when    ║
║  using 'npx' or when node-gyp build tools are not available.                ║
║                                                                              ║
║  Claude Flow will continue with JSON fallback storage (still works fine).   ║
║                                                                              ║
║  To enable SQLite storage:                                                   ║
║                                                                              ║
║  Option 1 - Install Build Tools (Windows):                                   ║
║  > npm install --global windows-build-tools                                  ║
║  > npm install claude-flow@alpha                                             ║
║                                                                              ║
║  Option 2 - Use WSL (Windows Subsystem for Linux):                           ║
║  Install WSL and run Claude Flow inside a Linux environment                  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
            }
            return false;
        }
    }
}
export async function isSQLiteAvailable() {
    if (sqliteAvailable !== null) {
        return sqliteAvailable;
    }
    await tryLoadSQLite();
    return sqliteAvailable;
}
export async function getSQLiteDatabase() {
    if (!sqliteAvailable && loadError === null) {
        await tryLoadSQLite();
    }
    return Database;
}
export function getLoadError() {
    return loadError;
}
export async function createDatabase(dbPath) {
    const DB = await getSQLiteDatabase();
    if (!DB) {
        throw new Error('SQLite is not available. Use fallback storage instead.');
    }
    try {
        return new DB(dbPath);
    } catch (err) {
        if (err.message.includes('EPERM') || err.message.includes('access denied')) {
            throw new Error(`Cannot create database at ${dbPath}. Permission denied. Try using a different directory or running with administrator privileges.`);
        }
        throw err;
    }
}
export function isWindows() {
    return process.platform === 'win32';
}
export function getStorageRecommendations() {
    if (isWindows()) {
        return {
            recommended: 'in-memory',
            reason: 'Windows native module compatibility',
            alternatives: [
                'Install Windows build tools for SQLite support',
                'Use WSL (Windows Subsystem for Linux)',
                'Use Docker container with Linux'
            ]
        };
    }
    return {
        recommended: 'sqlite',
        reason: 'Best performance and persistence',
        alternatives: [
            'in-memory for testing'
        ]
    };
}
tryLoadSQLite().catch(()=>{});
export default {
    isSQLiteAvailable,
    getSQLiteDatabase,
    getLoadError,
    createDatabase,
    isWindows,
    getStorageRecommendations
};

//# sourceMappingURL=sqlite-wrapper.js.map
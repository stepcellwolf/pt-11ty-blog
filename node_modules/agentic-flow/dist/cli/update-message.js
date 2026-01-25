/**
 * Update Message Display for agentic-flow
 * Displays philosophy-driven update notifications
 */
import chalk from 'chalk';
/**
 * Display update message with philosophy
 */
export function displayUpdateMessage(info) {
    const { currentVersion, latestVersion, releaseDate, features, philosophy } = info;
    console.log('\n');
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + '                                                              ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.bold.white('              agentic-flow v' + latestVersion + '                             ') + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.bold.yellow('              Intelligence Without Scale                       ') + chalk.cyan('║'));
    console.log(chalk.cyan('║') + '                                                              ' + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
    // Philosophy quote
    if (philosophy) {
        console.log(chalk.italic.gray('  "' + philosophy + '"'));
        console.log('');
    }
    // Key features
    console.log(chalk.bold.white('  ✨ What\'s New:'));
    console.log('');
    features.forEach(feature => {
        const [title, description] = feature.split(':');
        console.log(chalk.green('  •') + chalk.white(' ' + title.trim()));
        if (description) {
            console.log(chalk.gray('     └─ ' + description.trim()));
        }
    });
    console.log('');
    // Quick actions
    console.log(chalk.cyan('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('  Quick Start:                                                 ') + chalk.cyan('║'));
    console.log(chalk.cyan('╠══════════════════════════════════════════════════════════════╣'));
    console.log(chalk.cyan('║') + chalk.white('  Update:     ') + chalk.yellow('npm install -g agentic-flow@latest') + '            ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.white('  Skills:     ') + chalk.yellow('npx agentic-flow skills list') + '                  ' + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.white('  Learn:      ') + chalk.yellow('npx agentic-flow --help') + '                       ' + chalk.cyan('║'));
    console.log(chalk.cyan('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.gray('  Release Date: ' + releaseDate));
    console.log(chalk.gray('  Current Version: v' + currentVersion + ' → v' + latestVersion));
    console.log('');
}
/**
 * Display compact update notification
 */
export function displayCompactUpdate(currentVersion, latestVersion) {
    console.log('');
    console.log(chalk.yellow('🚀 Update Available: ') +
        chalk.gray('v' + currentVersion) +
        chalk.white(' → ') +
        chalk.green('v' + latestVersion));
    console.log('');
    console.log(chalk.white('   Run: ') + chalk.cyan('npm install -g agentic-flow@latest'));
    console.log('   ' + chalk.gray('Intelligence Without Scale'));
    console.log('');
}
/**
 * v1.7.0 specific update message
 */
export function displayV170Update() {
    displayUpdateMessage({
        currentVersion: '1.6.6',
        latestVersion: '1.7.0',
        releaseDate: 'October 19, 2025',
        philosophy: 'The future belongs to systems that are small, structured, and constantly learning.',
        features: [
            'Claude Code Skills: 20 skills for orchestration & AgentDB',
            'Graph-Based Learning: Self-reinforcing patterns through relationships',
            '150x-12,500x Performance: Light, local, and alive',
            'Model Optimizer: 85-98% cost savings through smart selection',
            'Agent-Booster: 352x faster code editing, $0 cost',
            'Adaptive AI: Learns HOW to think, not WHAT to think',
        ],
    });
}
/**
 * Philosophy-focused banner
 */
export function displayPhilosophyBanner() {
    console.log('\n');
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
    console.log('');
    console.log(chalk.bold.white('  Intelligence Without Scale'));
    console.log('');
    console.log(chalk.gray('  Some people think intelligence needs to be massive to matter.'));
    console.log(chalk.gray('  I\'ve learned it\'s the opposite.'));
    console.log('');
    console.log(chalk.white('  The future belongs to systems that are:'));
    console.log(chalk.green('  • Small') + chalk.gray(' - Binary quantization: 32x memory reduction'));
    console.log(chalk.green('  • Structured') + chalk.gray(' - Graph-based: relationships > repetition'));
    console.log(chalk.green('  • Constantly Learning') + chalk.gray(' - Self-reinforcing patterns'));
    console.log('');
    console.log(chalk.yellow('  ⚡ 150x-12,500x faster than traditional approaches'));
    console.log(chalk.yellow('  💰 $0 cost with local WASM execution'));
    console.log(chalk.yellow('  🧠 Adaptive AI that learns through feedback'));
    console.log('');
    console.log(chalk.italic.gray('  "The traditional approach treats every problem like a nail'));
    console.log(chalk.italic.gray('   because it only knows the hammer of scale. But the real'));
    console.log(chalk.italic.gray('   future of AI isn\'t heavy or closed—it\'s light, open,'));
    console.log(chalk.italic.gray('   and adaptive."'));
    console.log('');
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
    console.log('\n');
}
/**
 * Display graph intelligence explanation
 */
export function displayGraphIntelligence() {
    console.log('\n');
    console.log(chalk.bold.white('🧬 Graph-Based Intelligence'));
    console.log('');
    console.log(chalk.gray('  Traditional AI:           agentic-flow:'));
    console.log(chalk.gray('  ───────────────           ─────────────'));
    console.log(chalk.red('  Massive models       →   ') + chalk.green('Small vectors (32x smaller)'));
    console.log(chalk.red('  Dataset repetition   →   ') + chalk.green('Relationship learning'));
    console.log(chalk.red('  Static weights       →   ') + chalk.green('Self-reinforcing patterns'));
    console.log(chalk.red('  GPU-dependent        →   ') + chalk.green('CPU-optimized WASM'));
    console.log(chalk.red('  Declarative (what)   →   ') + chalk.green('Adaptive (how)'));
    console.log('');
    console.log(chalk.white('  How it works:'));
    console.log('');
    console.log(chalk.gray('  ┌─────────────────────┐'));
    console.log(chalk.gray('  │ Context Fragment    │') + chalk.white(' ← Idea/Result/Observation'));
    console.log(chalk.gray('  │ • Domain: "api"     │'));
    console.log(chalk.gray('  │ • Pattern: {...}    │'));
    console.log(chalk.gray('  │ • Confidence: 0.95  │'));
    console.log(chalk.gray('  └─────────────────────┘'));
    console.log(chalk.gray('           │'));
    console.log(chalk.gray('      ') + chalk.yellow('Similarity Links'));
    console.log(chalk.gray('           │'));
    console.log(chalk.gray('      ┌────┴────┐'));
    console.log(chalk.gray('      ▼         ▼'));
    console.log(chalk.gray('    Node A    Node B  ') + chalk.white('← Self-reinforcing graph'));
    console.log('');
    console.log(chalk.italic.gray('  Patterns emerge over time. The system learns without'));
    console.log(chalk.italic.gray('  retraining, adjusting its logic as it goes.'));
    console.log('\n');
}
/**
 * Check if update is available (placeholder - implement with npm registry check)
 */
export async function checkForUpdates(currentVersion) {
    try {
        // TODO: Implement actual npm registry check
        // For now, return mock data
        return {
            updateAvailable: false,
            latestVersion: currentVersion,
        };
    }
    catch (error) {
        return {
            updateAvailable: false,
        };
    }
}
/**
 * Display update notification on CLI startup (non-intrusive)
 */
export function displayStartupUpdateCheck(currentVersion, latestVersion) {
    if (currentVersion !== latestVersion) {
        console.log('');
        console.log(chalk.bgYellow.black(' UPDATE ') +
            ' ' +
            chalk.yellow('v' + latestVersion + ' available') +
            chalk.gray(' (current: v' + currentVersion + ')'));
        console.log(chalk.gray('         Run: ') + chalk.cyan('npm install -g agentic-flow@latest'));
        console.log('');
    }
}

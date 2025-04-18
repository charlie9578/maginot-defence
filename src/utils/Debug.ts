type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogCategory = 'grid' | 'combat' | 'input' | 'building' | 'enemy' | 'defense' | 'system';

interface LogOptions {
    category: LogCategory;
    level?: LogLevel;
    data?: any;
}

export class Debug {
    private static enabled = true;
    private static categories: Set<LogCategory> = new Set(['grid', 'combat', 'input', 'building', 'enemy', 'defense', 'system']);

    private static emojis: Record<LogCategory, string> = {
        grid: '📊',
        combat: '⚔️',
        input: '🖱️',
        building: '🏗️',
        enemy: '👾',
        defense: '🛡️',
        system: '🎮'
    };

    private static colors: Record<LogLevel, string> = {
        debug: '#808080',
        info: '#00ff00',
        warn: '#ffff00',
        error: '#ff0000'
    };

    static log(message: string, options: LogOptions) {
        if (!this.enabled || !this.categories.has(options.category)) return;

        const level = options.level || 'info';
        const emoji = this.emojis[options.category];
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        
        const style = `
            color: ${this.colors[level]};
            font-weight: ${level === 'error' ? 'bold' : 'normal'};
            ${level === 'warn' ? 'font-style: italic;' : ''}
        `;

        console.groupCollapsed(
            `%c${timestamp} ${emoji} [${options.category.toUpperCase()}] ${message}`,
            style
        );

        if (options.data) {
            console.table(options.data);
        }

        // Add stack trace for errors
        if (level === 'error') {
            console.trace('Stack trace:');
        }

        console.groupEnd();
    }

    static enableCategory(category: LogCategory) {
        this.categories.add(category);
    }

    static disableCategory(category: LogCategory) {
        this.categories.delete(category);
    }

    static enable() {
        this.enabled = true;
    }

    static disable() {
        this.enabled = false;
    }
} 
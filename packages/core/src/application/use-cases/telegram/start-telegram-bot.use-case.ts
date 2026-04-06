/**
 * Start Telegram Bot Use Case
 *
 * Starts the Telegram bot lifecycle using the credentials stored in
 * Settings. On incoming messages, dispatches to a command router that
 * handles a small set of Shep commands:
 *
 *   /start          — friendly greeting
 *   /help           — list available commands
 *   /features       — list the last N features (name + lifecycle)
 *   /status <name>  — show a feature's current lifecycle + branch
 *
 * Any other text is acknowledged with a short hint to use /help. This
 * keeps the initial scope tractable while mirroring Max's command-based
 * bot interaction model.
 *
 * Business rules:
 *   • Telegram must be enabled in Settings and have both a bot token and
 *     authorized user ID. Otherwise this use case throws — the caller
 *     decides how to surface that (e.g. the web UI shows a toast).
 *   • Idempotent: if the bot is already running, this is a noop.
 */

import { injectable, inject } from 'tsyringe';
import type {
  ITelegramBotService,
  TelegramIncomingMessage,
} from '../../ports/output/services/telegram-bot-service.interface.js';
import type { ISettingsRepository } from '../../ports/output/repositories/settings.repository.interface.js';
import type { IFeatureRepository } from '../../ports/output/repositories/feature-repository.interface.js';

export interface StartTelegramBotResult {
  readonly started: boolean;
  readonly alreadyRunning: boolean;
  readonly authorizedUserId: number;
}

const HELP_TEXT = [
  "I'm Shep, your autonomous SDLC platform.",
  '',
  'Commands:',
  '/start          — say hi',
  '/help           — show this help',
  '/features       — list recent features',
  '/status <name>  — show a feature status by name or slug',
].join('\n');

@injectable()
export class StartTelegramBotUseCase {
  constructor(
    @inject('ITelegramBotService')
    private readonly telegramBot: ITelegramBotService,
    @inject('ISettingsRepository')
    private readonly settingsRepository: ISettingsRepository,
    @inject('IFeatureRepository')
    private readonly featureRepository: IFeatureRepository
  ) {}

  async execute(): Promise<StartTelegramBotResult> {
    if (this.telegramBot.isRunning()) {
      const settings = await this.settingsRepository.load();
      const existingId = Number(settings?.telegramIntegration?.authorizedUserId ?? 0);
      return { started: false, alreadyRunning: true, authorizedUserId: existingId };
    }

    const settings = await this.settingsRepository.load();
    const cfg = settings?.telegramIntegration;

    if (!settings || !cfg?.enabled) {
      throw new Error('Telegram integration is disabled in settings');
    }
    if (!cfg.botToken) {
      throw new Error('Telegram bot token is not configured');
    }
    if (cfg.authorizedUserId === undefined || cfg.authorizedUserId === null) {
      throw new Error('Authorized Telegram user ID is not configured');
    }

    const authorizedUserId = Number(cfg.authorizedUserId);

    await this.telegramBot.start({
      botToken: cfg.botToken,
      authorizedUserId,
      handler: (msg) => this.handleMessage(msg),
    });

    return { started: true, alreadyRunning: false, authorizedUserId };
  }

  private async handleMessage(message: TelegramIncomingMessage): Promise<string | null> {
    const text = message.text.trim();
    if (!text) return null;

    const [command, ...rest] = text.split(/\s+/);
    const argument = rest.join(' ').trim();

    switch (command) {
      case '/start':
        return 'Shep is online. Send /help for commands.';
      case '/help':
        return HELP_TEXT;
      case '/features':
        return this.renderFeatureList();
      case '/status':
        if (!argument) return 'Usage: /status <feature-name-or-slug>';
        return this.renderFeatureStatus(argument);
      default:
        return "Didn't recognize that — try /help.";
    }
  }

  private async renderFeatureList(): Promise<string> {
    const features = await this.featureRepository.list();
    if (features.length === 0) return 'No features yet. Create one from the Shep UI.';

    const recent = features.slice(0, 10);
    const lines = recent.map((f) => `• ${f.name} — ${f.lifecycle}`);
    return `Recent features:\n${lines.join('\n')}`;
  }

  private async renderFeatureStatus(query: string): Promise<string> {
    const features = await this.featureRepository.list();
    const needle = query.toLowerCase();
    const match = features.find(
      (f) => f.name.toLowerCase() === needle || f.slug?.toLowerCase() === needle
    );
    if (!match) return `No feature found matching "${query}".`;

    const branchLine = match.branch ? `\nBranch: ${match.branch}` : '';
    return `📦 ${match.name}\nLifecycle: ${match.lifecycle}${branchLine}`;
  }
}

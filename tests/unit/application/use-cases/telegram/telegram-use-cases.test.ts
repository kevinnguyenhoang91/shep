/**
 * Telegram use-case unit tests.
 *
 * Covers:
 *  - TestTelegramConnectionUseCase — token validation + empty input
 *  - SendTelegramMessageUseCase — settings-driven noop paths + happy path
 *  - StartTelegramBotUseCase — guard errors + command router behavior
 *  - StopTelegramBotUseCase — idempotency
 *
 * All dependencies are mocked via `vi.fn()` — no real HTTP calls or
 * database connections are made. This keeps the suite fast and
 * deterministic, in line with the TDD guide.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestTelegramConnectionUseCase } from '@/application/use-cases/telegram/test-telegram-connection.use-case.js';
import { SendTelegramMessageUseCase } from '@/application/use-cases/telegram/send-telegram-message.use-case.js';
import { StartTelegramBotUseCase } from '@/application/use-cases/telegram/start-telegram-bot.use-case.js';
import { StopTelegramBotUseCase } from '@/application/use-cases/telegram/stop-telegram-bot.use-case.js';
import type { ITelegramBotService } from '@/application/ports/output/services/telegram-bot-service.interface.js';
import type { ISettingsRepository } from '@/application/ports/output/repositories/settings.repository.interface.js';
import type { IFeatureRepository } from '@/application/ports/output/repositories/feature-repository.interface.js';
import { createDefaultSettings } from '@/domain/factories/settings-defaults.factory.js';
import type { Settings, Feature } from '@/domain/generated/output.js';

function makeBotMock(overrides: Partial<ITelegramBotService> = {}): ITelegramBotService {
  return {
    testConnection: vi.fn(async () => ({ ok: true, botUsername: 'sheptestbot' })),
    sendMessage: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    isRunning: vi.fn(() => false),
    ...overrides,
  };
}

function makeSettingsRepoMock(settings: Settings | null): ISettingsRepository {
  return {
    initialize: vi.fn(async () => undefined),
    load: vi.fn(async () => settings),
    update: vi.fn(async () => undefined),
  };
}

function makeFeatureRepoMock(features: Feature[]): IFeatureRepository {
  return {
    list: vi.fn(async () => features),
  } as unknown as IFeatureRepository;
}

function configuredSettings(overrides: Partial<Settings['telegramIntegration']> = {}): Settings {
  const settings = createDefaultSettings();
  settings.telegramIntegration = {
    enabled: true,
    botToken: 'TEST:token',
    authorizedUserId: '42',
    ...overrides,
  };
  return settings;
}

describe('TestTelegramConnectionUseCase', () => {
  it('returns an error when the token is empty', async () => {
    const bot = makeBotMock();
    const useCase = new TestTelegramConnectionUseCase(bot);

    const result = await useCase.execute({ botToken: '   ' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/required/i);
    expect(bot.testConnection).not.toHaveBeenCalled();
  });

  it('delegates to the bot service and returns its result', async () => {
    const bot = makeBotMock({
      testConnection: vi.fn(async () => ({ ok: true, botUsername: 'xbot', botName: 'Xbot' })),
    });
    const useCase = new TestTelegramConnectionUseCase(bot);

    const result = await useCase.execute({ botToken: 'abc:123' });

    expect(result).toEqual({ ok: true, botUsername: 'xbot', botName: 'Xbot' });
    expect(bot.testConnection).toHaveBeenCalledWith('abc:123');
  });
});

describe('SendTelegramMessageUseCase', () => {
  it('skips sending when the integration is disabled', async () => {
    const settings = createDefaultSettings();
    settings.telegramIntegration = { enabled: false };
    const bot = makeBotMock();
    const repo = makeSettingsRepoMock(settings);
    const useCase = new SendTelegramMessageUseCase(bot, repo);

    const result = await useCase.execute({ text: 'hi' });

    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/disabled/);
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  it('skips sending when credentials are missing', async () => {
    const settings = createDefaultSettings();
    settings.telegramIntegration = { enabled: true };
    const bot = makeBotMock();
    const useCase = new SendTelegramMessageUseCase(bot, makeSettingsRepoMock(settings));

    const result = await useCase.execute({ text: 'hi' });

    expect(result.sent).toBe(false);
    expect(result.reason).toMatch(/not configured/);
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  it('sends the message to the authorized user when configured', async () => {
    const bot = makeBotMock();
    const useCase = new SendTelegramMessageUseCase(bot, makeSettingsRepoMock(configuredSettings()));

    const result = await useCase.execute({ text: 'hello from shep' });

    expect(result.sent).toBe(true);
    expect(bot.sendMessage).toHaveBeenCalledWith('TEST:token', 42, 'hello from shep');
  });

  it('honors an explicit chat id override', async () => {
    const bot = makeBotMock();
    const useCase = new SendTelegramMessageUseCase(bot, makeSettingsRepoMock(configuredSettings()));

    await useCase.execute({ text: 'x', chatId: 999 });

    expect(bot.sendMessage).toHaveBeenCalledWith('TEST:token', 999, 'x');
  });
});

describe('StartTelegramBotUseCase', () => {
  let settingsRepo: ISettingsRepository;
  let featureRepo: IFeatureRepository;
  let bot: ITelegramBotService;
  let useCase: StartTelegramBotUseCase;

  beforeEach(() => {
    settingsRepo = makeSettingsRepoMock(configuredSettings());
    featureRepo = makeFeatureRepoMock([
      {
        id: 'f1',
        name: 'login-flow',
        slug: 'login-flow',
        lifecycle: 'requirements',
        branch: 'feat/login-flow',
      } as unknown as Feature,
      {
        id: 'f2',
        name: 'dark-mode',
        slug: 'dark-mode',
        lifecycle: 'implementation',
        branch: 'feat/dark-mode',
      } as unknown as Feature,
    ]);
    bot = makeBotMock();
    useCase = new StartTelegramBotUseCase(bot, settingsRepo, featureRepo);
  });

  it('throws if telegram is disabled', async () => {
    const disabled = createDefaultSettings();
    disabled.telegramIntegration = { enabled: false };
    useCase = new StartTelegramBotUseCase(bot, makeSettingsRepoMock(disabled), featureRepo);

    await expect(useCase.execute()).rejects.toThrow(/disabled/);
    expect(bot.start).not.toHaveBeenCalled();
  });

  it('throws if credentials are incomplete', async () => {
    const noToken = configuredSettings({ botToken: undefined });
    useCase = new StartTelegramBotUseCase(bot, makeSettingsRepoMock(noToken), featureRepo);

    await expect(useCase.execute()).rejects.toThrow(/token/);
  });

  it('starts the bot and returns the authorized user id', async () => {
    const result = await useCase.execute();

    expect(result).toEqual({ started: true, alreadyRunning: false, authorizedUserId: 42 });
    expect(bot.start).toHaveBeenCalledTimes(1);
    const call = (bot.start as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.botToken).toBe('TEST:token');
    expect(call.authorizedUserId).toBe(42);
    expect(typeof call.handler).toBe('function');
  });

  it('is a no-op when the bot is already running', async () => {
    bot = makeBotMock({ isRunning: vi.fn(() => true) });
    useCase = new StartTelegramBotUseCase(bot, settingsRepo, featureRepo);

    const result = await useCase.execute();

    expect(result.started).toBe(false);
    expect(result.alreadyRunning).toBe(true);
    expect(bot.start).not.toHaveBeenCalled();
  });

  describe('command router', () => {
    async function dispatch(text: string): Promise<string | null> {
      await useCase.execute();
      const handler = (bot.start as ReturnType<typeof vi.fn>).mock.calls[0][0].handler;
      return handler({ chatId: 42, userId: 42, text });
    }

    it('responds to /start', async () => {
      const reply = await dispatch('/start');
      expect(reply).toMatch(/Shep is online/);
    });

    it('responds to /help with the command list', async () => {
      const reply = await dispatch('/help');
      expect(reply).toMatch(/\/features/);
      expect(reply).toMatch(/\/status/);
    });

    it('lists recent features on /features', async () => {
      const reply = await dispatch('/features');
      expect(reply).toMatch(/login-flow/);
      expect(reply).toMatch(/dark-mode/);
    });

    it('returns empty-state text when there are no features', async () => {
      featureRepo = makeFeatureRepoMock([]);
      useCase = new StartTelegramBotUseCase(bot, settingsRepo, featureRepo);
      const reply = await dispatch('/features');
      expect(reply).toMatch(/No features yet/);
    });

    it('renders status for a known feature', async () => {
      const reply = await dispatch('/status dark-mode');
      expect(reply).toMatch(/dark-mode/);
      expect(reply).toMatch(/implementation/);
      expect(reply).toMatch(/feat\/dark-mode/);
    });

    it('reports a helpful message when the feature is unknown', async () => {
      const reply = await dispatch('/status nope');
      expect(reply).toMatch(/No feature found/);
    });

    it('asks for an argument when /status is called without one', async () => {
      const reply = await dispatch('/status');
      expect(reply).toMatch(/Usage/);
    });

    it('nudges unknown commands toward /help', async () => {
      const reply = await dispatch('something else');
      expect(reply).toMatch(/\/help/);
    });
  });
});

describe('StopTelegramBotUseCase', () => {
  it('stops when the bot is running', async () => {
    const bot = makeBotMock({ isRunning: vi.fn(() => true) });
    const useCase = new StopTelegramBotUseCase(bot);

    const result = await useCase.execute();

    expect(result).toEqual({ stopped: true, wasRunning: true });
    expect(bot.stop).toHaveBeenCalled();
  });

  it('is a no-op when the bot is not running', async () => {
    const bot = makeBotMock({ isRunning: vi.fn(() => false) });
    const useCase = new StopTelegramBotUseCase(bot);

    const result = await useCase.execute();

    expect(result).toEqual({ stopped: false, wasRunning: false });
    expect(bot.stop).not.toHaveBeenCalled();
  });
});

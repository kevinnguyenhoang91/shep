'use client';

/**
 * Telegram Integration Settings Section
 *
 * Onboarding + management UI for Shep's Telegram bot integration.
 * Users paste a bot token from @BotFather and their numeric user ID
 * from @userinfobot, test the connection, and start/stop the bot
 * lifecycle from here.
 *
 * Mirrors the capability from Max (https://github.com/burkeholland/max)
 * while living entirely in Shep's Clean Architecture: no grammy import,
 * no HTTP calls from the component — everything flows through server
 * actions that resolve use cases from the DI container.
 */

import { useState, useTransition } from 'react';
import { Send, Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { updateSettingsAction } from '@/app/actions/update-settings';
import {
  testTelegramConnectionAction,
  startTelegramBotAction,
  stopTelegramBotAction,
  sendTelegramTestMessageAction,
} from '@/app/actions/telegram-integration';
import type { TelegramIntegrationConfig } from '@shepai/core/domain/generated/output';

export interface TelegramIntegrationSectionProps {
  telegramIntegration: TelegramIntegrationConfig | undefined;
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; botUsername?: string; botName?: string }
  | { status: 'error'; message: string };

const BOTFATHER_URL = 'https://t.me/BotFather';
const USERINFOBOT_URL = 'https://t.me/userinfobot';

function isValidUserId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function TelegramIntegrationSection({
  telegramIntegration,
}: TelegramIntegrationSectionProps) {
  const initialEnabled = telegramIntegration?.enabled ?? false;
  const initialToken = telegramIntegration?.botToken ?? '';
  const initialUserId = telegramIntegration?.authorizedUserId ?? '';
  const initialLabel = telegramIntegration?.authorizedUserLabel ?? '';

  const [enabled, setEnabled] = useState(initialEnabled);
  const [botToken, setBotToken] = useState(initialToken);
  const [userId, setUserId] = useState(initialUserId);
  const [label, setLabel] = useState(initialLabel);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const [isSaving, startSaveTransition] = useTransition();
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [isLifecyclePending, startLifecycleTransition] = useTransition();
  const [isSendingTest, startSendTestTransition] = useTransition();

  function persist(nextEnabled: boolean, nextToken: string, nextUserId: string, nextLabel: string) {
    startSaveTransition(async () => {
      const result = await updateSettingsAction({
        telegramIntegration: {
          enabled: nextEnabled,
          botToken: nextToken || undefined,
          authorizedUserId: nextUserId || undefined,
          authorizedUserLabel: nextLabel || undefined,
        },
      });
      if (!result.success) {
        toast.error(result.error ?? 'Failed to save Telegram settings');
        setEnabled(initialEnabled);
      }
    });
  }

  function handleEnabledChange(value: boolean) {
    if (value && (!botToken || !isValidUserId(userId))) {
      toast.error('Add a bot token and a numeric user ID before enabling.');
      return;
    }
    setEnabled(value);
    persist(value, botToken, userId, label);
  }

  function handleBlurToken() {
    if (botToken !== initialToken) persist(enabled, botToken, userId, label);
  }

  function handleBlurUserId() {
    if (userId && !isValidUserId(userId)) {
      toast.error('User ID must be a positive integer (get it from @userinfobot).');
      return;
    }
    if (userId !== initialUserId) persist(enabled, botToken, userId, label);
  }

  function handleBlurLabel() {
    if (label !== initialLabel) persist(enabled, botToken, userId, label);
  }

  async function handleTestConnection() {
    if (!botToken) {
      setTestState({ status: 'error', message: 'Paste a bot token first.' });
      return;
    }
    setTestState({ status: 'testing' });
    const result = await testTelegramConnectionAction(botToken);
    if (result.ok) {
      const next: TestState = { status: 'ok' };
      if (result.botUsername !== undefined) next.botUsername = result.botUsername;
      if (result.botName !== undefined) next.botName = result.botName;
      setTestState(next);
    } else {
      setTestState({ status: 'error', message: result.error ?? 'Unknown error' });
    }
  }

  function handleStartBot() {
    startLifecycleTransition(async () => {
      const result = await startTelegramBotAction();
      if (result.success) {
        setIsBotRunning(true);
        toast.success('Telegram bot started — open Telegram and send /start.');
      } else {
        toast.error(result.error ?? 'Failed to start bot');
      }
    });
  }

  function handleStopBot() {
    startLifecycleTransition(async () => {
      const result = await stopTelegramBotAction();
      if (result.success) {
        setIsBotRunning(false);
        toast.success('Telegram bot stopped.');
      } else {
        toast.error(result.error ?? 'Failed to stop bot');
      }
    });
  }

  function handleSendTest() {
    startSendTestTransition(async () => {
      const result = await sendTelegramTestMessageAction();
      if (result.sent) {
        toast.success('Test message sent — check Telegram.');
      } else {
        toast.error(result.error ?? 'Test message not sent');
      }
    });
  }

  const canTest = botToken.trim().length > 0;
  const canToggleLifecycle = enabled && Boolean(botToken) && isValidUserId(userId);

  return (
    <Card
      id="telegram-integration"
      className="scroll-mt-6"
      data-testid="telegram-integration-section"
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="text-muted-foreground h-4 w-4" />
            <CardTitle>Telegram</CardTitle>
          </div>
          {isSaving ? <span className="text-muted-foreground text-xs">Saving…</span> : null}
        </div>
        <CardDescription>
          Talk to Shep from your phone. Create a bot with{' '}
          <a
            href={BOTFATHER_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-0.5 underline"
          >
            @BotFather
            <ExternalLink className="h-3 w-3" />
          </a>
          , grab your numeric user ID from{' '}
          <a
            href={USERINFOBOT_URL}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-0.5 underline"
          >
            @userinfobot
            <ExternalLink className="h-3 w-3" />
          </a>
          , and paste them below.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Step 1 — bot token */}
        <div className="space-y-2">
          <Label htmlFor="telegram-bot-token">Bot token</Label>
          <div className="flex gap-2">
            <Input
              id="telegram-bot-token"
              data-testid="telegram-bot-token-input"
              type="password"
              placeholder="123456:ABC-DEF…"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              onBlur={handleBlurToken}
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!canTest || testState.status === 'testing'}
              onClick={handleTestConnection}
              data-testid="telegram-test-connection"
            >
              {testState.status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Test'
              )}
            </Button>
          </div>
          {testState.status === 'ok' ? (
            <p className="flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" />
              Connected as{' '}
              <span className="font-mono">
                @{testState.botUsername ?? 'unknown'}
                {testState.botName ? ` (${testState.botName})` : ''}
              </span>
            </p>
          ) : null}
          {testState.status === 'error' ? (
            <p className="text-destructive flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              {testState.message}
            </p>
          ) : null}
        </div>

        {/* Step 2 — lock it down */}
        <div className="space-y-2">
          <Label htmlFor="telegram-user-id">Your Telegram user ID</Label>
          <Input
            id="telegram-user-id"
            data-testid="telegram-user-id-input"
            inputMode="numeric"
            placeholder="123456789"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onBlur={handleBlurUserId}
            autoComplete="off"
          />
          <p className="text-muted-foreground text-xs">
            Only this user will be able to send messages to Shep. Every other user is ignored
            silently.
          </p>
        </div>

        {/* Optional label */}
        <div className="space-y-2">
          <Label htmlFor="telegram-user-label">Display label (optional)</Label>
          <Input
            id="telegram-user-label"
            data-testid="telegram-user-label-input"
            placeholder="e.g. Jane — personal"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlurLabel}
            autoComplete="off"
          />
        </div>

        <Separator />

        {/* Enable + lifecycle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="telegram-enabled" className="font-medium">
              Enable Telegram bot
            </Label>
            <p className="text-muted-foreground text-xs">
              When enabled, Shep can start a long-polling bot so you can control it from your phone.
            </p>
          </div>
          <Switch
            id="telegram-enabled"
            data-testid="telegram-enabled-switch"
            checked={enabled}
            onCheckedChange={handleEnabledChange}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {isBotRunning ? (
            <Button
              type="button"
              variant="outline"
              disabled={isLifecyclePending}
              onClick={handleStopBot}
              data-testid="telegram-stop-bot"
            >
              {isLifecyclePending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Stop bot'}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canToggleLifecycle || isLifecyclePending}
              onClick={handleStartBot}
              data-testid="telegram-start-bot"
            >
              {isLifecyclePending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Start bot'}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={!canToggleLifecycle || isSendingTest}
            onClick={handleSendTest}
            data-testid="telegram-send-test-message"
          >
            {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send test message'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

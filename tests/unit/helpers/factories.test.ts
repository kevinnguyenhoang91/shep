/**
 * Factory Builder Tests
 *
 * Verifies that all factory builders produce valid, well-typed objects
 * with sensible defaults and accept overrides correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  buildFeature,
  buildAgentRun,
  buildAgentSession,
  buildSettings,
  buildRepository,
  buildMockFeatureRepository,
  buildMockAgentRunRepository,
  buildMockSettingsRepository,
  buildMockRepositoryRepository,
  buildMockAgentSessionRepository,
} from '../../helpers/factories/index.js';
import { SdlcLifecycle, AgentRunStatus, AgentType } from '@/domain/generated/output.js';

describe('factory builders', () => {
  describe('buildFeature', () => {
    it('should create a feature with all required fields', () => {
      const feature = buildFeature();

      expect(feature.id).toBeDefined();
      expect(feature.name).toBe('test-feature');
      expect(feature.lifecycle).toBe(SdlcLifecycle.Started);
      expect(feature.messages).toEqual([]);
      expect(feature.relatedArtifacts).toEqual([]);
      expect(feature.approvalGates).toEqual({
        allowPrd: false,
        allowPlan: false,
        allowMerge: false,
      });
      expect(feature.createdAt).toBeInstanceOf(Date);
    });

    it('should accept overrides', () => {
      const feature = buildFeature({
        name: 'custom-feature',
        lifecycle: SdlcLifecycle.Implementation,
        fast: true,
      });

      expect(feature.name).toBe('custom-feature');
      expect(feature.lifecycle).toBe(SdlcLifecycle.Implementation);
      expect(feature.fast).toBe(true);
      // Non-overridden fields keep defaults
      expect(feature.push).toBe(false);
    });

    it('should generate unique IDs for each call', () => {
      const a = buildFeature();
      const b = buildFeature();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('buildAgentRun', () => {
    it('should create an agent run with all required fields', () => {
      const run = buildAgentRun();

      expect(run.id).toBeDefined();
      expect(run.agentType).toBe(AgentType.ClaudeCode);
      expect(run.agentName).toBe('analyze-repository');
      expect(run.status).toBe(AgentRunStatus.running);
      expect(run.prompt).toBeDefined();
      expect(run.threadId).toBeDefined();
    });

    it('should accept overrides', () => {
      const run = buildAgentRun({
        status: AgentRunStatus.completed,
        result: 'Analysis complete',
      });

      expect(run.status).toBe(AgentRunStatus.completed);
      expect(run.result).toBe('Analysis complete');
    });
  });

  describe('buildAgentSession', () => {
    it('should create a session with all required fields', () => {
      const session = buildAgentSession();

      expect(session.id).toBeDefined();
      expect(session.agentType).toBe(AgentType.ClaudeCode);
      expect(session.projectPath).toBeDefined();
      expect(session.messageCount).toBe(0);
    });

    it('should accept overrides', () => {
      const session = buildAgentSession({ messageCount: 5 });
      expect(session.messageCount).toBe(5);
    });
  });

  describe('buildSettings', () => {
    it('should create settings with all required fields', () => {
      const settings = buildSettings();

      expect(settings.id).toBeDefined();
      expect(settings.models.default).toBeDefined();
      expect(settings.agent.type).toBe(AgentType.ClaudeCode);
      expect(settings.workflow.ciWatchEnabled).toBe(true);
      expect(settings.onboardingComplete).toBe(false);
      expect(settings.notifications.events.agentFailed).toBe(true);
    });

    it('should accept overrides', () => {
      const settings = buildSettings({
        onboardingComplete: true,
        models: { default: 'gpt-4' },
      });

      expect(settings.onboardingComplete).toBe(true);
      expect(settings.models.default).toBe('gpt-4');
    });
  });

  describe('buildRepository', () => {
    it('should create a repository with all required fields', () => {
      const repo = buildRepository();

      expect(repo.id).toBeDefined();
      expect(repo.name).toBe('test-repo');
      expect(repo.path).toBe('/repo');
    });

    it('should accept overrides', () => {
      const repo = buildRepository({ name: 'my-repo', path: '/my/repo' });

      expect(repo.name).toBe('my-repo');
      expect(repo.path).toBe('/my/repo');
    });
  });

  describe('repository mocks', () => {
    it('should build a mock feature repository with all interface methods', () => {
      const mock = buildMockFeatureRepository();

      expect(mock.create).toBeDefined();
      expect(mock.findById).toBeDefined();
      expect(mock.findByIdPrefix).toBeDefined();
      expect(mock.findBySlug).toBeDefined();
      expect(mock.findByBranch).toBeDefined();
      expect(mock.list).toBeDefined();
      expect(mock.findByParentId).toBeDefined();
      expect(mock.update).toBeDefined();
      expect(mock.delete).toBeDefined();
      expect(mock.softDelete).toBeDefined();
    });

    it('should build a mock agent run repository with all interface methods', () => {
      const mock = buildMockAgentRunRepository();

      expect(mock.create).toBeDefined();
      expect(mock.findById).toBeDefined();
      expect(mock.findByThreadId).toBeDefined();
      expect(mock.updateStatus).toBeDefined();
      expect(mock.updatePinnedConfig).toBeDefined();
      expect(mock.findRunningByPid).toBeDefined();
      expect(mock.findByIds).toBeDefined();
      expect(mock.list).toBeDefined();
      expect(mock.delete).toBeDefined();
    });

    it('should build a mock settings repository with all interface methods', () => {
      const mock = buildMockSettingsRepository();

      expect(mock.initialize).toBeDefined();
      expect(mock.load).toBeDefined();
      expect(mock.update).toBeDefined();
    });

    it('should build a mock repository repository with all interface methods', () => {
      const mock = buildMockRepositoryRepository();

      expect(mock.create).toBeDefined();
      expect(mock.findById).toBeDefined();
      expect(mock.findByPath).toBeDefined();
      expect(mock.findByPathIncludingDeleted).toBeDefined();
      expect(mock.findByRemoteUrl).toBeDefined();
      expect(mock.findByUpstreamUrl).toBeDefined();
      expect(mock.list).toBeDefined();
      expect(mock.remove).toBeDefined();
      expect(mock.softDelete).toBeDefined();
      expect(mock.restore).toBeDefined();
      expect(mock.update).toBeDefined();
    });

    it('should build a mock agent session repository with all interface methods', () => {
      const mock = buildMockAgentSessionRepository();

      expect(mock.list).toBeDefined();
      expect(mock.findById).toBeDefined();
      expect(mock.isSupported).toBeDefined();
    });

    it('should return sensible defaults from mock methods', async () => {
      const featureRepo = buildMockFeatureRepository();
      const runRepo = buildMockAgentRunRepository();

      expect(await featureRepo.findById('id')).toBeNull();
      expect(await featureRepo.list()).toEqual([]);
      expect(await runRepo.findById('id')).toBeNull();
      expect(await runRepo.list()).toEqual([]);
    });
  });
});

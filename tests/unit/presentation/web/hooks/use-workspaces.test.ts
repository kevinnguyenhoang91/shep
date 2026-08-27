import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useWorkspaces,
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
} from '../../../../../src/presentation/web/hooks/use-workspaces.js';
import type { Workspace } from '../../../../../src/presentation/web/hooks/use-workspaces.js';

const STORAGE_KEY = 'shep:workspaces:v1';

describe('useWorkspaces', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should start with default workspace', () => {
      const { result } = renderHook(() => useWorkspaces());

      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.workspaces[0]).toMatchObject({
        id: DEFAULT_WORKSPACE_ID,
        name: DEFAULT_WORKSPACE_NAME,
      });
    });

    it('should load persisted workspaces from localStorage on mount', async () => {
      const persisted: Workspace[] = [
        {
          id: DEFAULT_WORKSPACE_ID,
          name: DEFAULT_WORKSPACE_NAME,
          repoIds: [],
          featureIds: [],
        },
        {
          id: 'ws-1',
          name: 'My Workspace',
          repoIds: ['repo-1'],
          featureIds: ['feat-1'],
        },
      ];
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ workspaces: persisted, activeWorkspaceId: 'ws-1' })
      );

      const { result } = renderHook(() => useWorkspaces());

      // Wait for hydration effect to complete
      await waitFor(() => {
        expect(result.current.workspaces).toHaveLength(2);
      });

      expect(result.current.activeWorkspaceId).toBe('ws-1');
    });
  });

  describe('createWorkspace', () => {
    it('should create a new workspace', () => {
      const { result } = renderHook(() => useWorkspaces());

      act(() => {
        result.current.createWorkspace('Test Workspace');
      });

      expect(result.current.workspaces).toHaveLength(2);
      expect(result.current.workspaces[1]).toMatchObject({
        name: 'Test Workspace',
      });
    });

    it('should persist new workspace to localStorage', async () => {
      const { result } = renderHook(() => useWorkspaces());

      await act(async () => {
        result.current.createWorkspace('Test Workspace');
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.workspaces).toHaveLength(2);
      expect(stored.workspaces[1]).toMatchObject({
        name: 'Test Workspace',
      });
    });

    it('should survive a simulated browser reload', async () => {
      // First render: create a workspace
      const { result: result1, unmount: unmount1 } = renderHook(() => useWorkspaces());

      await act(async () => {
        result1.current.createWorkspace('Persisted Workspace');
      });

      const workspaceId = result1.current.workspaces[1]!.id;
      const workspaceName = result1.current.workspaces[1]!.name;

      // Simulate browser reload by unmounting and remounting
      unmount1();

      // Second render: should have persisted workspace
      const { result: result2, rerender } = renderHook(() => useWorkspaces());

      // Allow effect to run by rerendering
      await act(async () => {
        rerender();
      });

      expect(result2.current.workspaces).toHaveLength(2);
      expect(result2.current.workspaces[1]).toMatchObject({
        id: workspaceId,
        name: workspaceName,
      });
    });
  });

  describe('renameWorkspace', () => {
    it('should rename a workspace and persist to localStorage', async () => {
      const { result } = renderHook(() => useWorkspaces());

      let workspaceId: string;
      await act(async () => {
        const ws = result.current.createWorkspace('Original Name');
        workspaceId = ws.id;
      });

      await act(async () => {
        result.current.renameWorkspace(workspaceId!, 'New Name');
      });

      const ws = result.current.workspaces.find((w) => w.id === workspaceId);
      expect(ws?.name).toBe('New Name');

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      const storedWs = stored.workspaces.find((w: Workspace) => w.id === workspaceId);
      expect(storedWs?.name).toBe('New Name');
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete a workspace and persist to localStorage', async () => {
      const { result } = renderHook(() => useWorkspaces());

      let workspaceId: string;
      await act(async () => {
        const ws = result.current.createWorkspace('To Delete');
        workspaceId = ws.id;
      });

      expect(result.current.workspaces).toHaveLength(2);

      await act(async () => {
        result.current.deleteWorkspace(workspaceId!);
      });

      expect(result.current.workspaces).toHaveLength(1);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.workspaces).toHaveLength(1);
    });
  });

  describe('setWorkspaceMembers', () => {
    it('should update workspace members and persist to localStorage', async () => {
      const { result } = renderHook(() => useWorkspaces());

      let workspaceId: string;
      await act(async () => {
        const ws = result.current.createWorkspace('Test');
        workspaceId = ws.id;
      });

      await act(async () => {
        result.current.setWorkspaceMembers(workspaceId!, {
          repoIds: ['repo-1'],
          featureIds: ['feat-1'],
        });
      });

      const ws = result.current.workspaces.find((w) => w.id === workspaceId);
      expect(ws?.repoIds).toEqual(['repo-1']);
      expect(ws?.featureIds).toEqual(['feat-1']);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      const storedWs = stored.workspaces.find((w: Workspace) => w.id === workspaceId);
      expect(storedWs?.repoIds).toEqual(['repo-1']);
      expect(storedWs?.featureIds).toEqual(['feat-1']);
    });
  });

  describe('localStorage safety', () => {
    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json');

      const { result } = renderHook(() => useWorkspaces());

      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.activeWorkspaceId).toBe(DEFAULT_WORKSPACE_ID);
    });

    it('should ensure default workspace always exists', async () => {
      const persisted = {
        workspaces: [
          {
            id: 'ws-1',
            name: 'Custom Workspace',
            repoIds: [],
            featureIds: [],
          },
        ],
        activeWorkspaceId: 'ws-1',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));

      const { result, rerender } = renderHook(() => useWorkspaces());

      await act(async () => {
        rerender();
      });

      const hasDefault = result.current.workspaces.some((w) => w.id === DEFAULT_WORKSPACE_ID);
      expect(hasDefault).toBe(true);
    });
  });
});

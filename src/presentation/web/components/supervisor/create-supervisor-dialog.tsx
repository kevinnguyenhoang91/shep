'use client';

/**
 * CreateSupervisorDialog
 *
 * Lets the user create a brand-new supervisor policy without first
 * navigating into an application/repository page. Picks the scope, then
 * delegates to the existing {@link SupervisorConfigForm} (so add and edit
 * flows stay in lock-step).
 *
 * Fetches the candidate apps/repos/features as props from the parent
 * server component — keeps this component stateless w.r.t. data
 * loading.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SupervisorConfigForm } from './supervisor-config-form';

export interface ScopeOption {
  id: string;
  name: string;
}

export interface CreateSupervisorDialogProps {
  /** Apps the user can attach a supervisor to. */
  applications: ScopeOption[];
  /** Repositories the user can attach a supervisor to. */
  repositories: ScopeOption[];
  /** Features the user can override at, optionally scoped to an app or repo. */
  features: (ScopeOption & { applicationId?: string; repositoryId?: string })[];
  /** Force the dialog open (used by tests/Storybook). */
  initialOpen?: boolean;
}

type ScopeKind = 'global' | 'app' | 'repo' | 'feature';

export function CreateSupervisorDialog({
  applications,
  repositories,
  features,
  initialOpen,
}: CreateSupervisorDialogProps) {
  const [open, setOpen] = useState(Boolean(initialOpen));
  const [scope, setScope] = useState<ScopeKind>('global');
  const [appId, setAppId] = useState<string>('');
  const [repoId, setRepoId] = useState<string>('');
  const [featureId, setFeatureId] = useState<string>('');

  function reset() {
    setScope('global');
    setAppId('');
    setRepoId('');
    setFeatureId('');
  }

  const ready =
    scope === 'global' ||
    (scope === 'app' && appId.length > 0) ||
    (scope === 'repo' && repoId.length > 0) ||
    (scope === 'feature' && featureId.length > 0);

  const formScopeType = scope === 'feature' ? deriveFeatureParentScope(featureId, features) : scope;
  const formScopeId =
    scope === 'app'
      ? appId
      : scope === 'repo'
        ? repoId
        : scope === 'feature'
          ? deriveFeatureParentId(featureId, features)
          : undefined;
  const formFeatureId = scope === 'feature' ? featureId : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button data-testid="create-supervisor-trigger">
          <Plus className="size-4" />
          Create supervisor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" data-testid="create-supervisor-dialog">
        <DialogHeader>
          <DialogTitle>Create supervisor policy</DialogTitle>
          <DialogDescription>
            Pick the scope this supervisor watches, then configure how aggressive it should be.
            More-specific scopes override less-specific ones at run time.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-supervisor-scope">Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as ScopeKind)}>
              <SelectTrigger id="create-supervisor-scope" data-testid="scope-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global default</SelectItem>
                <SelectItem value="app" disabled={applications.length === 0}>
                  Application{applications.length === 0 ? ' (none yet)' : ''}
                </SelectItem>
                <SelectItem value="repo" disabled={repositories.length === 0}>
                  Repository{repositories.length === 0 ? ' (none yet)' : ''}
                </SelectItem>
                <SelectItem value="feature" disabled={features.length === 0}>
                  Per-feature override{features.length === 0 ? ' (none yet)' : ''}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === 'app' ? (
            <ScopeOptionPicker
              id="create-supervisor-app"
              label="Application"
              value={appId}
              onChange={setAppId}
              options={applications}
              testid="app-trigger"
            />
          ) : null}

          {scope === 'repo' ? (
            <ScopeOptionPicker
              id="create-supervisor-repo"
              label="Repository"
              value={repoId}
              onChange={setRepoId}
              options={repositories}
              testid="repo-trigger"
            />
          ) : null}

          {scope === 'feature' ? (
            <ScopeOptionPicker
              id="create-supervisor-feature"
              label="Feature"
              value={featureId}
              onChange={setFeatureId}
              options={features.map((f) => ({ id: f.id, name: f.name }))}
              testid="feature-trigger"
            />
          ) : null}
        </div>

        {ready ? (
          <SupervisorConfigForm
            scopeType={formScopeType}
            {...(formScopeId !== undefined && { scopeId: formScopeId })}
            {...(formFeatureId !== undefined && { featureId: formFeatureId })}
            initialPolicy={null}
          />
        ) : (
          <DialogFooter>
            <p className="text-muted-foreground text-xs">
              Pick a scope above to configure the supervisor.
            </p>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScopeOptionPicker({
  id,
  label,
  value,
  onChange,
  options,
  testid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: ScopeOption[];
  testid?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
        <SelectTrigger id={id} data-testid={testid}>
          <SelectValue placeholder={`Pick a ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function deriveFeatureParentScope(
  featureId: string,
  features: CreateSupervisorDialogProps['features']
): string {
  if (!featureId) return 'global';
  const feat = features.find((f) => f.id === featureId);
  if (feat?.applicationId) return 'app';
  if (feat?.repositoryId) return 'repo';
  return 'global';
}

function deriveFeatureParentId(
  featureId: string,
  features: CreateSupervisorDialogProps['features']
): string | undefined {
  if (!featureId) return undefined;
  const feat = features.find((f) => f.id === featureId);
  return feat?.applicationId ?? feat?.repositoryId;
}

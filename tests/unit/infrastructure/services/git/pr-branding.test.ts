import { describe, it, expect } from 'vitest';
import {
  PR_BRANDING,
  COMMIT_CO_AUTHOR,
  applyPrBranding,
  applyCommitBranding,
  limitCommitSubjectLength,
} from '@/infrastructure/services/git/pr-branding.js';

describe('PR_BRANDING', () => {
  it('should contain the Shep branding text', () => {
    expect(PR_BRANDING).toContain('Shep');
    expect(PR_BRANDING).toContain('https://github.com/shep-ai/shep');
  });
});

describe('COMMIT_CO_AUTHOR', () => {
  it('should contain Shep Bot attribution', () => {
    expect(COMMIT_CO_AUTHOR).toContain('Shep Bot');
    expect(COMMIT_CO_AUTHOR).toContain('shep-agent@users.noreply.github.com');
  });

  it('should not contain Claude attribution', () => {
    expect(COMMIT_CO_AUTHOR).not.toContain('Claude');
    expect(COMMIT_CO_AUTHOR).not.toContain('anthropic');
  });
});

describe('applyPrBranding', () => {
  it('should append Shep branding to a plain body', () => {
    const result = applyPrBranding('## Summary\n\nSome changes');
    expect(result).toContain('## Summary');
    expect(result).toContain('Some changes');
    expect(result.endsWith(PR_BRANDING)).toBe(true);
  });

  it('should strip Claude Code branding and add Shep branding', () => {
    const body =
      '## Summary\n\nSome changes\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)';
    const result = applyPrBranding(body);
    expect(result).not.toContain('Claude Code');
    expect(result).not.toContain('claude.com');
    expect(result).toContain(PR_BRANDING);
  });

  it('should strip Claude Code branding without emoji prefix', () => {
    const body =
      '## Summary\n\nSome changes\n\nGenerated with [Claude Code](https://claude.com/claude-code)';
    const result = applyPrBranding(body);
    expect(result).not.toContain('Claude Code');
    expect(result).toContain(PR_BRANDING);
  });

  it('should strip Claude Co-Authored-By trailers from PR body', () => {
    const body = '## Summary\n\nSome changes\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
    const result = applyPrBranding(body);
    expect(result).not.toContain('Claude');
    expect(result).not.toContain('anthropic.com');
    expect(result).toContain(PR_BRANDING);
  });

  it('should strip Claude Opus Co-Authored-By trailers from PR body', () => {
    const body =
      '## Summary\n\nSome changes\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>';
    const result = applyPrBranding(body);
    expect(result).not.toContain('Claude Opus');
    expect(result).not.toContain('anthropic.com');
    expect(result).toContain(PR_BRANDING);
  });

  it('should not duplicate branding if already present', () => {
    const body = `## Summary\n\nSome changes\n\n${PR_BRANDING}`;
    const result = applyPrBranding(body);
    const count = result.split(PR_BRANDING).length - 1;
    expect(count).toBe(1);
  });

  it('should handle empty body', () => {
    const result = applyPrBranding('');
    expect(result).toContain(PR_BRANDING);
  });

  it('should replace Claude Code branding when mixed with other content', () => {
    const body = [
      '## Summary',
      '',
      'Added a feature',
      '',
      '## Test Plan',
      '',
      '- [x] Unit tests pass',
      '',
      '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
    ].join('\n');

    const result = applyPrBranding(body);
    expect(result).not.toContain('Claude Code');
    expect(result).toContain('## Test Plan');
    expect(result.endsWith(PR_BRANDING)).toBe(true);
  });

  it('should trim trailing whitespace before appending branding', () => {
    const result = applyPrBranding('Some content   \n\n\n');
    expect(result).toBe(`Some content\n\n${PR_BRANDING}`);
  });
});

describe('applyCommitBranding', () => {
  it('should append Shep Bot co-author to a plain commit message', () => {
    const result = applyCommitBranding('feat(cli): add status command');
    expect(result).toContain('feat(cli): add status command');
    expect(result).toContain(COMMIT_CO_AUTHOR);
  });

  it('should strip Claude co-author and add Shep Bot co-author', () => {
    const message =
      'feat(cli): add status command\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
    const result = applyCommitBranding(message);
    expect(result).not.toContain('Claude');
    expect(result).not.toContain('anthropic.com');
    expect(result).toContain(COMMIT_CO_AUTHOR);
  });

  it('should strip Claude Opus co-author trailer', () => {
    const message =
      'feat(web): add dark mode\n\nCo-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>';
    const result = applyCommitBranding(message);
    expect(result).not.toContain('Claude Opus');
    expect(result).not.toContain('anthropic.com');
    expect(result).toContain(COMMIT_CO_AUTHOR);
  });

  it('should strip Claude Sonnet co-author trailer', () => {
    const message =
      'fix(ci): fix build\n\nCo-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>';
    const result = applyCommitBranding(message);
    expect(result).not.toContain('Claude Sonnet');
    expect(result).not.toContain('anthropic.com');
    expect(result).toContain(COMMIT_CO_AUTHOR);
  });

  it('should not duplicate co-author if already present', () => {
    const message = `feat(cli): add status command\n\n${COMMIT_CO_AUTHOR}`;
    const result = applyCommitBranding(message);
    const count = result.split(COMMIT_CO_AUTHOR).length - 1;
    expect(count).toBe(1);
  });

  it('should handle message with body before co-author', () => {
    const message =
      'feat(cli): add status command\n\nThis adds a new status command.\n\nCo-Authored-By: Claude <noreply@anthropic.com>';
    const result = applyCommitBranding(message);
    expect(result).toContain('This adds a new status command.');
    expect(result).not.toContain('Claude');
    expect(result).toContain(COMMIT_CO_AUTHOR);
  });

  it('should trim trailing whitespace before appending co-author', () => {
    const result = applyCommitBranding('feat(cli): add command   \n\n\n');
    expect(result).toBe(`feat(cli): add command\n\n${COMMIT_CO_AUTHOR}`);
  });
});

describe('limitCommitSubjectLength', () => {
  it('should not modify subjects under 72 characters', () => {
    const message = 'feat: add new feature';
    const result = limitCommitSubjectLength(message);
    expect(result).toBe(message);
  });

  it('should not modify subjects exactly 72 characters', () => {
    const subject = 'a'.repeat(72);
    const result = limitCommitSubjectLength(subject);
    expect(result).toBe(subject);
  });

  it('should truncate subjects longer than 72 characters', () => {
    const message = 'a'.repeat(80);
    const result = limitCommitSubjectLength(message);
    expect(result.length).toBe(72);
    expect(result).toBe('a'.repeat(72));
  });

  it('should preserve body when truncating subject', () => {
    const subject = 'a'.repeat(80);
    const body = 'This is the commit body';
    const message = `${subject}\n${body}`;
    const result = limitCommitSubjectLength(message);
    expect(result.startsWith('a'.repeat(72))).toBe(true);
    expect(result).toContain('This is the commit body');
    expect(result).toBe(`${'a'.repeat(72)}\n${body}`);
  });

  it('should handle multi-line messages with body', () => {
    const message =
      'feat: this is a very long subject line that definitely exceeds seventy two characters\n\nThis is the body';
    const result = limitCommitSubjectLength(message);
    const lines = result.split('\n');
    expect(lines[0].length).toBe(72);
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('This is the body');
  });

  it('should handle squash merge commit format', () => {
    const branch = 'feat/very-long-feature-branch-name-that-is-quite-lengthy';
    const baseBranch = 'main';
    const message = `feat: squash merge ${branch} into ${baseBranch}`;
    const result = limitCommitSubjectLength(message);
    expect(result.length).toBe(72);
    expect(result.startsWith('feat: squash merge')).toBe(true);
  });

  it('should handle empty body after split', () => {
    const subject = 'a'.repeat(80);
    const message = `${subject}\n`;
    const result = limitCommitSubjectLength(message);
    expect(result).toBe('a'.repeat(72));
  });

  it('should preserve multiple body paragraphs', () => {
    const subject = 'a'.repeat(80);
    const body = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
    const message = `${subject}\n${body}`;
    const result = limitCommitSubjectLength(message);
    expect(result).toContain('First paragraph');
    expect(result).toContain('Second paragraph');
    expect(result).toContain('Third paragraph');
    expect(result.startsWith('a'.repeat(72))).toBe(true);
  });
});

/**
 * Feedback for the `startFeature` action.
 *
 * Starting a feature that depends on another one does not always start it: the
 * dependency gate sends it (back) to Blocked until the work it depends on has
 * landed. That is a successful outcome, not an error, and it needs its own
 * message — reporting "Feature started" would be a lie, and reporting a failure
 * would be one too.
 */

import type { startFeature } from '@/app/actions/start-feature';

export type StartFeatureResponse = Awaited<ReturnType<typeof startFeature>>;

/** Message explaining that the dependency gate held the feature back. */
export function blockedStartMessage(result: StartFeatureResponse): string {
  return result.blockedBy
    ? `Waiting for "${result.blockedBy}" to complete before this can start`
    : 'Waiting for the feature it depends on to complete before this can start';
}

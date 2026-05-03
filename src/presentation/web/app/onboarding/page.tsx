import { notFound } from 'next/navigation';
import { getFeatureFlags } from '@/lib/feature-flags';
import { OnboardingTutorial } from '@/components/onboarding/onboarding-tutorial';

export const dynamic = 'force-dynamic';

export default function OnboardingRoute() {
  const flags = getFeatureFlags();
  if (!flags.collaboration) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <OnboardingTutorial />
    </div>
  );
}

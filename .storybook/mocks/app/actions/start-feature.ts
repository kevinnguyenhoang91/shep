export async function startFeature(
  _featureId: string
): Promise<{ started: boolean; blocked?: boolean; blockedBy?: string; error?: string }> {
  return { started: true };
}

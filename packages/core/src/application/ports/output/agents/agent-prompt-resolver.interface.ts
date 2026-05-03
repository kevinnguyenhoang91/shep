/**
 * Agent Prompt Resolver Output Port (spec 093, FR-36)
 *
 * Single in-process lookup point that returns the active override body
 * for (agentType, promptId) when one exists, otherwise the supplied
 * fallback string. Every prompt call site in the agent runtime goes
 * through this resolver so a user-edited prompt takes effect without
 * touching unrelated nodes.
 *
 * The fallback contract makes removing an override a byte-identical
 * restore (NFR-16): pass the bundled string in, get it back when no
 * row exists, no merge / template substitution.
 */
export interface IAgentPromptResolver {
  /**
   * Resolve the prompt for the (agentType, promptId) slot.
   *
   * @param agentType   Stable identifier of the agent (e.g. "feature-agent").
   * @param promptId    Stable identifier of the prompt within the agent.
   * @param fallback    Bundled prompt body — returned verbatim when no override exists.
   * @returns Promise of the active override body, or the fallback.
   */
  resolve(agentType: string, promptId: string, fallback: string): Promise<string>;
}

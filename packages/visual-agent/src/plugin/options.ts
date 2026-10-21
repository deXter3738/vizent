export type VisualAgentOptions = {
  /**
   * Keyboard shortcut that toggles the picker. Alt/Option + this key.
   * @default "v"
   */
  hotkey?: string;
  /**
   * Print each selection to the dev server terminal.
   * @default false
   */
  verbose?: boolean;
};

export type ResolvedOptions = Required<VisualAgentOptions>;

export function resolveOptions(options: VisualAgentOptions = {}): ResolvedOptions {
  return {
    hotkey: (options.hotkey ?? "v").toLowerCase(),
    verbose: options.verbose ?? false,
  };
}

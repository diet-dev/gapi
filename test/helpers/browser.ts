export function browserGlobals(root: typeof globalThis) {
  // Node-тесты создают только те части браузерного окружения, которые нужны сценарию.
  return root as unknown as {window: Record<string, unknown>; confirm: typeof confirm};
}

export function loadScript(src: string, cb?: (success: boolean) => void): void {
  const d = document;
  const s = d.createElement("script");

  s.src = src;
  s.async = true;
  d.body.append(s);

  s.onload = () => cb?.(true);
  s.onerror = () => cb?.(false);
}

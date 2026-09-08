// This is a static tripwire, not a substitute for CSP and browser request audits.
export function externalNetworkCalls(code) {
  return [
    ...code.matchAll(
      /(?:fetch|sendBeacon|WebSocket|XMLHttpRequest|importScripts)\s*\(\s*["'`]https?:\/\/|\.\s*(?:src|href)\s*=\s*["'`]https?:\/\/|(?:src|srcset)\s*:\s*["'`]https?:\/\//g,
    ),
  ].map((match) => match[0]);
}

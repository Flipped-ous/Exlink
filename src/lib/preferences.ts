export type Preferences = {
  theme: 'dark' | 'light'; glass: boolean; wave: boolean; waveCollapsed: boolean;
  commands: boolean; hiddenChannels: string[]; channelUnits: Record<string, string>;
};
export const preferenceKey = 'exlink.preferences.v3';
export const defaultPreferences: Preferences = { theme: 'dark', glass: true, wave: true, waveCollapsed: false, commands: true, hiddenChannels: [], channelUnits: {} };
export function parsePreferences(current: string | null, legacy: string | null = null): Preferences {
  try {
    const v = JSON.parse(current ?? legacy ?? '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...defaultPreferences };
    return {
      theme: v.theme === 'light' ? 'light' : 'dark', glass: typeof v.glass === 'boolean' ? v.glass : true,
      wave: typeof v.wave === 'boolean' ? v.wave : true, commands: typeof v.commands === 'boolean' ? v.commands : true,
      waveCollapsed: typeof v.waveCollapsed === 'boolean' ? v.waveCollapsed : v.view === 'log',
      hiddenChannels: Array.isArray(v.hiddenChannels) ? [...new Set(v.hiddenChannels.filter((k: unknown): k is string => typeof k === 'string' && k.length > 0 && k.length <= 64))].slice(0, 32) as string[] : [],
      channelUnits: v.channelUnits && typeof v.channelUnits === 'object' && !Array.isArray(v.channelUnits) ? Object.fromEntries(Object.entries(v.channelUnits).filter(([key, unit]) => key.length > 0 && key.length <= 64 && ['数值','V','A','RPM','°C','Hz'].includes(unit as string)).slice(0,32)) as Record<string,string> : {},
    };
  } catch { return { ...defaultPreferences }; }
}
export function readPreferences() {
  try { return parsePreferences(localStorage.getItem(preferenceKey), localStorage.getItem('exlink.preferences.v2')); }
  catch { return { ...defaultPreferences }; }
}

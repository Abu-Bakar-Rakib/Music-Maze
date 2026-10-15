import type { CSSProperties } from 'react';

type IconName = 'arrow' | 'play' | 'pause' | 'volume' | 'muted' | 'headphones' | 'reset' | 'code' | 'close' | 'download' | 'copy' | 'check' | 'help' | 'home';

export default function Icon({ name, size = 20, className = '', style }: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    play: <path d="m9 5 11 7-11 7Z" />,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
    volume: <><path d="m11 5-5 4H3v6h3l5 4Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
    muted: <><path d="m11 5-5 4H3v6h3l5 4Z" /><path d="m16 9 6 6m0-6-6 6" /></>,
    headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
    reset: <><path d="M4 10a8 8 0 1 1 1.7 8.1M4 4v6h6" /></>,
    code: <><path d="m7 6-6 6 6 6m10-12 6 6-6 6m-3-14-4 16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V3H3v12h5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.1.9-1.1 1.7m0 3h.01" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{paths[name]}</svg>;
}
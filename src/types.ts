export interface XtreamAuth {
  url: string;
  user: string;
  pass: string;
}

export type ContentType = 'live' | 'vod' | 'series';

export interface Episode {
  id: string;
  episodeNum: number;
  seasonNum: number;
  title: string;
  url: string;
  duration?: string;
  plot?: string;
  containerExtension?: string;
}

export interface Season {
  seasonNumber: number;
  name: string;
  episodeCount: number;
}

export interface Channel {
  id: string;
  name: string;
  url: string;
  group: string;
  logo: string;
  streamId?: string | number;
  seriesId?: string | number;
  isFavorite?: boolean;
  smartTags?: string[];
  contentType?: ContentType;
  containerExtension?: string;
  rating?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  episodes?: Episode[];
  seasons?: Season[];
}

export interface Playlist {
  id: string;
  name: string;
  channels: Channel[];
  createdAt: number;
  xtreamAuth?: XtreamAuth;
  sourceUrl?: string;
  vodChannels?: Channel[];
  seriesChannels?: Channel[];
}

export interface EpgProgram {
  id: string;
  title: string;
  description: string;
  startTimestamp: number;
  stopTimestamp: number;
}

export interface ErrorLog {
  id: string;
  timestamp: number;
  type: string;
  details?: string;
  message?: string;
  channelName?: string;
}

export type ThemeMode = 'dark' | 'light' | 'oled';
export type DohProvider = 'disabled' | 'cloudflare' | 'quad9' | 'google' | 'custom';
export type UserAgentProfile = 'default' | 'vlc' | 'smarttv_lg' | 'smarttv_samsung' | 'exoplayer' | 'appletv' | 'custom';

export interface AppSettings {
  dataSaver: boolean;
  categoryOrder: string[];
  hiddenCategories: string[];
  themeColor: string;
  theme: ThemeMode;
  oledTheme?: boolean;
  dohProvider: DohProvider;
  dohCustomUrl?: string;
  userAgentProfile: UserAgentProfile;
  customUserAgent?: string;
  pinProtection: boolean;
  pinCode?: string;
  pinHash?: string;
  appLockEnabled?: boolean;
  biometricAuth: boolean;
  adultLock: boolean;
  lockedCategories: string[];
  leanbackMode: boolean;
  zapMode: boolean;
  ramBufferSizeMb: number;
  hardwareAcceleration: boolean;
}

export interface ExternalSubtitle {
  id: string;
  label: string;
  url: string;
  delay: number; // in seconds
}

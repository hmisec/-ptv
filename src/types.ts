export interface XtreamAuth {
  url: string;
  user: string;
  pass: string;
}

export interface Channel {
  id: string;
  name: string;
  url: string;
  group: string;
  logo: string;
  streamId?: string | number;
  isFavorite?: boolean;
  smartTags?: string[];
}

export interface Playlist {
  id: string;
  name: string;
  channels: Channel[];
  createdAt: number;
  xtreamAuth?: XtreamAuth;
  sourceUrl?: string;
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
  details: string;
  channelName?: string;
}

export interface AppSettings {
  dataSaver: boolean;
  categoryOrder: string[];
  hiddenCategories: string[];
  themeColor: string;
}

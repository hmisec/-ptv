export interface Channel {
  id: string;
  name: string;
  url: string;
  group: string;
  logo: string;
}

export interface Playlist {
  id: string;
  name: string;
  channels: Channel[];
  createdAt: number;
}

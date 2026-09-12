import { Channel } from '../types';

export function parseM3U(content: string): Channel[] {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      // Parse #EXTINF:-1 tvg-id="" tvg-name="" tvg-logo="" group-title="",Channel Name
      
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      
      const commaIndex = line.lastIndexOf(',');
      const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Bilinmeyen Kanal';

      currentChannel = {
        id: Math.random().toString(36).substr(2, 9),
        name: name || 'Bilinmeyen Kanal',
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : 'Genel',
      };
    } else if (line.startsWith('http')) {
      if (currentChannel.name) {
        currentChannel.url = line;
        channels.push(currentChannel as Channel);
        currentChannel = {}; // Reset for next channel
      }
    }
  }

  return channels;
}

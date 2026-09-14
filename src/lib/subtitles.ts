/**
 * Converts standard SubRip (.srt) subtitle string to WebVTT format for HTML5 <track>
 */
export function srtToVtt(srtText: string): string {
  // Normalize newlines
  let vtt = 'WEBVTT\n\n' + srtText.replace(/\r\n|\r/g, '\n');

  // Replace comma decimal separators in timestamps with period
  // e.g. 00:01:20,000 --> 00:01:20.000
  vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  return vtt;
}

/**
 * Creates a Blob URL from subtitle text (.srt or .vtt)
 */
export function createSubtitleTrackUrl(subtitleContent: string, isSrt: boolean = true): string {
  const vttContent = isSrt ? srtToVtt(subtitleContent) : subtitleContent;
  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  return URL.createObjectURL(blob);
}

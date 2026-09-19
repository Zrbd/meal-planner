// One way to get text out of the app: the iOS share sheet if it's there, the clipboard if not.
export type ShareResult = 'shared' | 'copied' | 'failed';

export async function shareText(title: string, text: string): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      // The user tapping Cancel throws AbortError; that isn't a failure worth a fallback.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Hand the user a file the app generated (a .ics, a backup) as a download. */
export function downloadFile(filename: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

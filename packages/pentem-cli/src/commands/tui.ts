import { startTUI } from '../tui/app.ts';

export async function tuiCommand(): Promise<void> {
  await startTUI();
  return new Promise(() => {});
}

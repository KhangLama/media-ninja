// A simple memory-only store to hold a file during client-side router navigation
let sharedFile: File | null = null;

export function setSharedFile(file: File | null) {
  sharedFile = file;
}

export function getSharedFile(): File | null {
  const file = sharedFile;
  sharedFile = null; // Clear immediately to ensure one-time usage
  return file;
}

// A simple memory-only store to hold a file during client-side router navigation
let sharedFile: File | null = null;

export function setSharedFile(file: File | null) {
  sharedFile = file;
}

export function getSharedFile(): File | null {
  return sharedFile;
}

export function clearSharedFile() {
  sharedFile = null;
}

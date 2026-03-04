export {};

declare global {
  interface Window {
    google?: any;
    [key: string]: unknown;
  }
}

declare namespace google {
  const maps: any;
}

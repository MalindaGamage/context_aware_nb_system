const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

let googleMapsLoader: Promise<any> | null = null;

export function getGoogleMapsApiKey() {
  return GOOGLE_MAPS_API_KEY.trim();
}

export async function loadGoogleMaps() {
  if (window.google?.maps) {
    return window.google.maps;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error("Missing Google Maps API key");
  }

  if (googleMapsLoader) {
    return googleMapsLoader;
  }

  googleMapsLoader = new Promise((resolve, reject) => {
    const callbackName = `__nbaGoogleMapsInit_${Date.now()}`;
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: apiKey,
      libraries: "places",
      v: "weekly",
      callback: callbackName,
    });

    const cleanup = () => {
      delete window[callbackName];
    };

    window[callbackName] = () => {
      cleanup();
      resolve(window.google.maps);
    };

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      cleanup();
      googleMapsLoader = null;
      reject(new Error("Failed to load Google Maps"));
    };

    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

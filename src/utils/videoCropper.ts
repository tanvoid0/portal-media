export interface VideoSettings {
  aspectRatio: string;
  zoom: number;
  positionX: number;
  positionY: number;
}

export function detectVideoElements(): HTMLVideoElement[] {
  // Detect all video elements in the current document
  const videos = Array.from(document.querySelectorAll("video"));
  return videos;
}

export function detectVideoInIframe(iframe: HTMLIFrameElement): HTMLVideoElement[] {
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      return Array.from(iframeDoc.querySelectorAll("video"));
    }
  } catch (_e) {
    // Cross-origin restrictions
    console.log("Cannot access iframe content for video detection");
  }
  return [];
}

export function applyVideoSettings(
  video: HTMLVideoElement,
  settings: VideoSettings
): void {
  // Calculate aspect ratio
  const [widthRatio, heightRatio] = settings.aspectRatio.split(":").map(Number);
  const targetAspectRatio = widthRatio / heightRatio;

  // Get container dimensions
  const container = video.parentElement || document.body;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const containerAspectRatio = containerWidth / containerHeight;

  // Calculate zoom and position
  const zoom = settings.zoom / 100;
  const positionX = settings.positionX / 100;
  const positionY = settings.positionY / 100;

  // Apply CSS transforms
  let transform = "";
  let objectFit: string = "cover";
  const clipPath = "";

  if (targetAspectRatio > containerAspectRatio) {
    // Video is wider than container - fit to height, crop width
    const scaledWidth = containerHeight * targetAspectRatio * zoom;
    const scaledHeight = containerHeight * zoom;
    const offsetX = (scaledWidth - containerWidth) * (0.5 - positionX);
    const offsetY = (scaledHeight - containerHeight) * (0.5 - positionY);

    transform = `translate(${-offsetX}px, ${-offsetY}px) scale(${zoom})`;
    objectFit = "cover";
  } else {
    // Video is taller than container - fit to width, crop height
    const scaledWidth = containerWidth * zoom;
    const scaledHeight = (containerWidth / targetAspectRatio) * zoom;
    const offsetX = (scaledWidth - containerWidth) * (0.5 - positionX);
    const offsetY = (scaledHeight - containerHeight) * (0.5 - positionY);

    transform = `translate(${-offsetX}px, ${-offsetY}px) scale(${zoom})`;
    objectFit = "cover";
  }

  // Apply styles
  video.style.objectFit = objectFit;
  video.style.transform = transform;
  video.style.transformOrigin = "center center";
  video.style.width = "100%";
  video.style.height = "100%";

  // Apply clip-path for precise cropping if needed
  if (clipPath) {
    video.style.clipPath = clipPath;
  }
}

export function applyVideoSettingsToAll(settings: VideoSettings): void {
  const videos = detectVideoElements();
  videos.forEach((video) => {
    applyVideoSettings(video, settings);
  });
}

export function injectVideoManipulationScript(
  doc: Document,
  settings: VideoSettings
): void {
  const script = doc.createElement("script");
  script.textContent = `
    (function() {
      const settings = ${JSON.stringify(settings)};
      
      function applySettings() {
        const videos = document.querySelectorAll("video");
        videos.forEach(video => {
          const [widthRatio, heightRatio] = settings.aspectRatio.split(":").map(Number);
          const targetAspectRatio = widthRatio / heightRatio;
          const zoom = settings.zoom / 100;
          const positionX = settings.positionX / 100;
          const positionY = settings.positionY / 100;
          
          const container = video.parentElement || document.body;
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          const containerAspectRatio = containerWidth / containerHeight;
          
          let transform = "";
          
          if (targetAspectRatio > containerAspectRatio) {
            const scaledWidth = containerHeight * targetAspectRatio * zoom;
            const scaledHeight = containerHeight * zoom;
            const offsetX = (scaledWidth - containerWidth) * (0.5 - positionX);
            const offsetY = (scaledHeight - containerHeight) * (0.5 - positionY);
            transform = \`translate(\${-offsetX}px, \${-offsetY}px) scale(\${zoom})\`;
          } else {
            const scaledWidth = containerWidth * zoom;
            const scaledHeight = (containerWidth / targetAspectRatio) * zoom;
            const offsetX = (scaledWidth - containerWidth) * (0.5 - positionX);
            const offsetY = (scaledHeight - containerHeight) * (0.5 - positionY);
            transform = \`translate(\${-offsetX}px, \${-offsetY}px) scale(\${zoom})\`;
          }
          
          video.style.objectFit = "cover";
          video.style.transform = transform;
          video.style.transformOrigin = "center center";
          video.style.width = "100%";
          video.style.height = "100%";
        });
      }
      
      // Apply on load
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applySettings);
      } else {
        applySettings();
      }
      
      // Watch for new video elements
      const observer = new MutationObserver(applySettings);
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Reapply on window resize
      window.addEventListener("resize", applySettings);
    })();
  `;
  doc.head.appendChild(script);
}

export function injectAdblockScript(doc: Document): void {
  const script = doc.createElement("script");
  script.textContent = `
    (function() {
      // Basic adblock - block common ad selectors
      const adSelectors = [
        '[class*="ad"]',
        '[id*="ad"]',
        '[class*="advertisement"]',
        '[id*="advertisement"]',
        '[class*="banner"]',
        'iframe[src*="doubleclick"]',
        'iframe[src*="googlesyndication"]',
        'iframe[src*="adservice"]',
      ];
      
      function blockAds() {
        adSelectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el.tagName === "IFRAME") {
                el.remove();
              } else {
                el.style.display = "none";
              }
            });
          } catch (_e) {
            // Ignore invalid selectors
          }
        });
      }
      
      // Block on load
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", blockAds);
      } else {
        blockAds();
      }
      
      // Watch for new ads
      const observer = new MutationObserver(blockAds);
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Block popups
      window.addEventListener("beforeunload", (e) => {
        // Allow navigation but block popups
      });
      
      // Override window.open to block popups
      const originalOpen = window.open;
      window.open = function(...args) {
        const url = args[0];
        if (url && (
          url.includes("popup") ||
          url.includes("advertisement") ||
          url.includes("doubleclick") ||
          url.includes("googlesyndication")
        )) {
          return null;
        }
        return originalOpen.apply(window, args);
      };
    })();
  `;
  doc.head.appendChild(script);
}


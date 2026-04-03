export interface SitePermissions {
  allowCookies: boolean;
  allowAds: boolean;
  allowPopups: boolean;
}

const DEFAULT_PERMISSIONS: SitePermissions = {
  allowCookies: false,
  allowAds: false,
  allowPopups: false,
};

export function getSitePermissions(domain: string): SitePermissions {
  try {
    const saved = localStorage.getItem(`sitePermissions_${domain}`);
    if (saved) {
      return { ...DEFAULT_PERMISSIONS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load site permissions:", e);
  }
  return { ...DEFAULT_PERMISSIONS };
}

export function setSitePermissions(domain: string, permissions: Partial<SitePermissions>): void {
  try {
    const current = getSitePermissions(domain);
    const updated = { ...current, ...permissions };
    localStorage.setItem(`sitePermissions_${domain}`, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save site permissions:", e);
  }
}

export function injectCookieDenialScript(doc: Document, allowCookies: boolean = false): void {
  if (allowCookies) {
    // If cookies are allowed, don't inject denial script
    return;
  }

  const script = doc.createElement("script");
  script.textContent = `
    (function() {
      // Auto-deny cookie consent dialogs
      // This script automatically clicks "Reject" or "Deny" buttons on cookie consent banners
      
      const denySelectors = [
        // Common "Reject" button selectors
        'button:contains("Reject")',
        'button:contains("Deny")',
        'button:contains("Decline")',
        'button:contains("Refuse")',
        'button:contains("Not Accept")',
        'button:contains("Don\u0027t Accept")',
        '[id*="reject"]',
        '[id*="deny"]',
        '[id*="decline"]',
        '[class*="reject"]',
        '[class*="deny"]',
        '[class*="decline"]',
        '[data-testid*="reject"]',
        '[data-testid*="deny"]',
        // Common cookie banner close buttons
        '[aria-label*="Reject"]',
        '[aria-label*="Deny"]',
        '[aria-label*="Decline"]',
        '[aria-label*="Close"]',
        // Specific patterns
        '.cookie-consent-reject',
        '.cookie-reject',
        '.gdpr-reject',
        '.cc-reject',
        '.cookie-banner-reject',
        '#cookie-reject',
        '#gdpr-reject',
        '#cc-reject',
      ];
      
      // Also look for "Only Essential" or "Necessary Only" options
      const essentialSelectors = [
        'button:contains("Only Essential")',
        'button:contains("Essential Only")',
        'button:contains("Necessary Only")',
        'button:contains("Required Only")',
        '[id*="essential"]',
        '[class*="essential"]',
        '[data-testid*="essential"]',
      ];
      
      function findAndClick(selectors, textPatterns) {
        // Try CSS selectors first
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              if (el.offsetParent !== null) { // Element is visible
                el.click();
                return true;
              }
            });
          } catch (e) {
            // Invalid selector, continue
          }
        }
        
        // Try text-based search
        const allButtons = document.querySelectorAll('button, a, [role="button"], [onclick]');
        for (const btn of allButtons) {
          const text = btn.textContent?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          const combined = text + ' ' + ariaLabel;
          
          if (textPatterns.some(pattern => combined.includes(pattern.toLowerCase()))) {
            if (btn.offsetParent !== null) {
              btn.click();
              return true;
            }
          }
        }
        
        return false;
      }
      
      function denyCookies() {
        const denyPatterns = ["reject", "deny", "decline", "refuse", "not accept", "don't accept", "no thanks"];
        const essentialPatterns = ['only essential', 'essential only', 'necessary only', 'required only'];
        
        // Try to find and click deny/essential buttons
        if (findAndClick(denySelectors, denyPatterns)) {
          return;
        }
        
        if (findAndClick(essentialSelectors, essentialPatterns)) {
          return;
        }
        
        // Fallback: Look for cookie banners and try to close them
        const cookieBanners = document.querySelectorAll(
          '[id*="cookie"], [class*="cookie"], [id*="gdpr"], [class*="gdpr"], [id*="consent"], [class*="consent"]'
        );
        
        cookieBanners.forEach(banner => {
          // Look for close button within banner
          const closeBtn = banner.querySelector('button, [role="button"], .close, [aria-label*="close"]');
          if (closeBtn && closeBtn.offsetParent !== null) {
            closeBtn.click();
          }
        });
      }
      
      // Run immediately
      denyCookies();
      
      // Watch for dynamically added cookie banners
      const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length > 0) {
            shouldCheck = true;
          }
        });
        if (shouldCheck) {
          setTimeout(denyCookies, 100);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Also check periodically in case banners load late
      setInterval(denyCookies, 2000);
    })();
  `;
  doc.head.appendChild(script);
}

export function injectPopupBlockingScript(doc: Document, allowPopups: boolean = false): void {
  if (allowPopups) {
    return;
  }

  const script = doc.createElement("script");
  script.textContent = `
    (function() {
      // Block popups
      const originalOpen = window.open;
      window.open = function(...args) {
        const url = args[0];
        // Allow same-origin popups for legitimate uses
        if (url && typeof url === 'string') {
          try {
            const currentOrigin = window.location.origin;
            const popupUrl = new URL(url, currentOrigin);
            // Block cross-origin popups and known ad/popup patterns
            if (popupUrl.origin !== currentOrigin || 
                url.includes('popup') || 
                url.includes('advertisement') ||
                url.includes('doubleclick') ||
                url.includes('googlesyndication')) {
              console.log('Blocked popup:', url);
              return null;
            }
          } catch (e) {
            // Invalid URL, block it
            return null;
          }
        }
        return originalOpen.apply(window, args);
      };
      
      // Block beforeunload popups
      window.addEventListener('beforeunload', (e) => {
        // Allow navigation but prevent popup dialogs
        e.preventDefault();
        e.returnValue = '';
      });
    })();
  `;
  doc.head.appendChild(script);
}


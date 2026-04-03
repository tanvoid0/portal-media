// Injected into the main webview on external URLs (React is not mounted). Top-edge hover
// strip so controls stay available in borderless windows and HTML5 video fullscreen.
(function () {
  const HIDE_MS = 4000;

  function createTitlebar() {
    if (!document.body) {
      setTimeout(createTitlebar, 100);
      return;
    }

    if (document.getElementById("portal-browser-titlebar")) return;

    var stalePanel = document.getElementById("portal-permissions-panel");
    if (stalePanel) stalePanel.remove();

    let hideTimer = null;

    const root = document.createElement("div");
    root.id = "portal-browser-titlebar";
    root.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:2147483647",
      "font-family:system-ui,-apple-system,sans-serif",
      "display:flex",
      "flex-direction:column",
      "align-items:stretch",
      "pointer-events:auto",
    ].join(";");

    const hit = document.createElement("div");
    hit.title = "Hover top edge for Portal controls";
    hit.style.cssText = [
      "min-height:14px",
      "width:100%",
      "cursor:default",
      "background:linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.12) 55%, transparent 100%)",
    ].join(";");

    const panel = document.createElement("div");
    panel.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "padding:6px 12px",
      "background:rgba(22,22,26,0.82)",
      "backdrop-filter:saturate(180%) blur(12px)",
      "-webkit-backdrop-filter:saturate(180%) blur(12px)",
      "border-bottom:1px solid rgba(255,255,255,0.12)",
      "box-shadow:0 6px 28px rgba(0,0,0,0.45)",
      "max-height:0",
      "opacity:0",
      "overflow:hidden",
      "transition:max-height 0.22s ease, opacity 0.2s ease",
      "pointer-events:none",
    ].join(";");

    function setExpanded(on) {
      if (on) {
        panel.style.maxHeight = "100px";
        panel.style.opacity = "1";
        panel.style.pointerEvents = "auto";
      } else {
        panel.style.maxHeight = "0";
        panel.style.opacity = "0";
        panel.style.pointerEvents = "none";
      }
    }

    function scheduleCollapse() {
      cancelCollapse();
      hideTimer = setTimeout(function () {
        setExpanded(false);
        hideTimer = null;
      }, HIDE_MS);
    }

    function cancelCollapse() {
      if (hideTimer != null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function onEnter() {
      cancelCollapse();
      setExpanded(true);
    }

    function onLeave() {
      scheduleCollapse();
    }

    function mkBtn(html, title, onClick, danger) {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = html;
      b.title = title;
      b.style.cssText = [
        "width:36px",
        "height:36px",
        "border:none",
        "background:transparent",
        "color:#fff",
        "cursor:pointer",
        "border-radius:8px",
        "font-size:17px",
        "line-height:1",
        "display:flex",
        "align-items:center",
        "justify-content:center",
      ].join(";");
      b.onmouseenter = function () {
        b.style.background = danger ? "rgba(255,60,60,0.22)" : "rgba(255,255,255,0.12)";
      };
      b.onmouseleave = function () {
        b.style.background = "transparent";
      };
      b.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      };
      return b;
    }

    const homeBtn = mkBtn("⌂", "Back to app", function () {
      window.location.href = "index.html";
    });
    const backBtn = mkBtn("←", "Back", function () {
      window.history.back();
    });
    const forwardBtn = mkBtn("→", "Forward", function () {
      window.history.forward();
    });
    const reloadBtn = mkBtn("↻", "Reload", function () {
      window.location.reload();
    });
    const closeBtn = mkBtn("✕", "Close browser", function () {
      window.location.href = "index.html";
    }, true);

    const urlDisplay = document.createElement("div");
    urlDisplay.style.cssText = [
      "flex:1",
      "color:rgba(255,255,255,0.88)",
      "font-size:13px",
      "padding:0 8px",
      "overflow:hidden",
      "text-overflow:ellipsis",
      "white-space:nowrap",
    ].join(";");
    urlDisplay.textContent = window.location.href;

    const permissionsBtn = mkBtn("⚙", "Site permissions", function () {});
    permissionsBtn.style.position = "relative";

    const permissionsPanel = document.createElement("div");
    permissionsPanel.id = "portal-permissions-panel";
    permissionsPanel.style.cssText = [
      "position:fixed",
      "top:52px",
      "right:16px",
      "width:300px",
      "background:#16161a",
      "border:1px solid rgba(255,255,255,0.1)",
      "border-radius:8px",
      "padding:16px",
      "z-index:2147483647",
      "box-shadow:0 8px 32px rgba(0,0,0,0.55)",
      "display:none",
      "font-family:system-ui,-apple-system,sans-serif",
    ].join(";");

    const domain = window.location.hostname.replace(/^www\./, "");

    function getPermissions() {
      try {
        var stored = localStorage.getItem("sitePermissions_" + domain);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return { allowCookies: false, allowAds: false, allowPopups: false };
    }

    function savePermissions(perms) {
      try {
        localStorage.setItem("sitePermissions_" + domain, JSON.stringify(perms));
      } catch (e) {}
    }

    function renderPermissionsUI() {
      var perms = getPermissions();
      permissionsPanel.innerHTML =
        '<div style="margin-bottom:12px;color:#fff;font-weight:600;font-size:16px;">Site Permissions</div>' +
        '<div style="margin-bottom:8px;color:rgba(255,255,255,0.6);font-size:12px;">' +
        domain +
        "</div>" +
        '<div style="margin-top:16px;display:flex;flex-direction:column;gap:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="color:#fff;font-size:14px;">🍪 Allow Cookies</span>' +
        '<button id="perm-cookies" type="button" style="width:60px;height:28px;border:1px solid rgba(255,255,255,0.2);background:' +
        (perms.allowCookies ? "#007bff" : "transparent") +
        ';color:#fff;border-radius:4px;cursor:pointer;font-size:12px;">' +
        (perms.allowCookies ? "Allow" : "Deny") +
        "</button></div>" +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="color:#fff;font-size:14px;">🚫 Allow Ads</span>' +
        '<button id="perm-ads" type="button" style="width:60px;height:28px;border:1px solid rgba(255,255,255,0.2);background:' +
        (perms.allowAds ? "#007bff" : "transparent") +
        ';color:#fff;border-radius:4px;cursor:pointer;font-size:12px;">' +
        (perms.allowAds ? "Allow" : "Block") +
        "</button></div>" +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="color:#fff;font-size:14px;">📦 Allow Popups</span>' +
        '<button id="perm-popups" type="button" style="width:60px;height:28px;border:1px solid rgba(255,255,255,0.2);background:' +
        (perms.allowPopups ? "#007bff" : "transparent") +
        ';color:#fff;border-radius:4px;cursor:pointer;font-size:12px;">' +
        (perms.allowPopups ? "Allow" : "Block") +
        "</button></div></div>";

      var cookiesBtn = permissionsPanel.querySelector("#perm-cookies");
      var adsBtn = permissionsPanel.querySelector("#perm-ads");
      var popupsBtn = permissionsPanel.querySelector("#perm-popups");

      if (cookiesBtn) {
        cookiesBtn.onclick = function () {
          perms.allowCookies = !perms.allowCookies;
          savePermissions(perms);
          renderPermissionsUI();
          setTimeout(function () {
            window.location.reload();
          }, 500);
        };
      }
      if (adsBtn) {
        adsBtn.onclick = function () {
          perms.allowAds = !perms.allowAds;
          savePermissions(perms);
          renderPermissionsUI();
          setTimeout(function () {
            window.location.reload();
          }, 500);
        };
      }
      if (popupsBtn) {
        popupsBtn.onclick = function () {
          perms.allowPopups = !perms.allowPopups;
          savePermissions(perms);
          renderPermissionsUI();
          setTimeout(function () {
            window.location.reload();
          }, 500);
        };
      }
    }

    renderPermissionsUI();
    document.body.appendChild(permissionsPanel);

    permissionsBtn.onclick = function (e) {
      e.stopPropagation();
      var isVisible = permissionsPanel.style.display !== "none";
      permissionsPanel.style.display = isVisible ? "none" : "block";
    };

    document.addEventListener("click", function (e) {
      if (!permissionsPanel.contains(e.target) && e.target !== permissionsBtn) {
        permissionsPanel.style.display = "none";
      }
    });

    panel.appendChild(homeBtn);
    panel.appendChild(backBtn);
    panel.appendChild(forwardBtn);
    panel.appendChild(reloadBtn);
    panel.appendChild(urlDisplay);
    panel.appendChild(permissionsBtn);
    panel.appendChild(closeBtn);

    root.appendChild(hit);
    root.appendChild(panel);
    root.onmouseenter = onEnter;
    root.onmouseleave = onLeave;

    document.body.appendChild(root);
    setExpanded(false);

    window.addEventListener("popstate", function () {
      urlDisplay.textContent = window.location.href;
    });

    // HTML5 fullscreen (e.g. Netflix player): keep strip — do NOT hide UI (legacy behavior).
    function syncFullscreenUi() {
      /* no-op: hover strip stays; hit zone remains for exit */
    }
    document.addEventListener("fullscreenchange", syncFullscreenUi);
    document.addEventListener("webkitfullscreenchange", syncFullscreenUi);

    if (!window.__portalTitlebarObserver) {
      window.__portalTitlebarObserver = new MutationObserver(function () {
        if (!document.getElementById("portal-browser-titlebar")) {
          createTitlebar();
        }
      });
      window.__portalTitlebarObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createTitlebar);
  } else {
    createTitlebar();
  }
  setTimeout(createTitlebar, 400);
  setTimeout(createTitlebar, 1200);
  setTimeout(createTitlebar, 2500);
})();

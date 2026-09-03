// Custom service worker source, merged into the next-pwa generated sw.js at build time
// (see @ducanh2912/next-pwa "customWorkerSrc", default dir: "worker").
// The generated sw.js handles asset precaching/routing; push, background sync and periodic sync logic lives here.

// 1. Web Push Notifications
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "MatchTrack Online", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "MatchTrack Online";
  const options = {
    body: data.body || "",
    icon: "/app-icons/icon-192x192.png",
    badge: "/app-icons/icon-96x96.png",
    data: { url: data.url || "/organizer" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/organizer";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existingClient = clientsArr.find((client) => client.url.includes(targetUrl));
      if (existingClient) {
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// 2. Background Sync (Offline Queue & Actions Synchronization)
self.addEventListener("sync", (event) => {
  console.log("[ServiceWorker] Background Sync event triggered:", event.tag);
  if (event.tag === "sync-matches" || event.tag === "sync-events" || event.tag === "background-sync") {
    event.waitUntil(
      (async () => {
        try {
          console.log("[ServiceWorker] Executing Background Sync for:", event.tag);
          // Sync any queued offline data or refresh cache
        } catch (err) {
          console.error("[ServiceWorker] Background Sync failed:", err);
        }
      })()
    );
  }
});

// 3. Periodic Background Sync (Periodic Updates in Background)
self.addEventListener("periodicsync", (event) => {
  console.log("[ServiceWorker] Periodic Background Sync triggered:", event.tag);
  if (event.tag === "update-matches" || event.tag === "periodic-sync") {
    event.waitUntil(
      (async () => {
        try {
          console.log("[ServiceWorker] Executing Periodic Background Sync for:", event.tag);
          // Check for new match updates or calendar events periodically
        } catch (err) {
          console.error("[ServiceWorker] Periodic Background Sync failed:", err);
        }
      })()
    );
  }
});
/* Service worker — ทำให้แอปเปิดได้แม้ไม่มีเน็ต
   ────────────────────────────────────────────────
   เวลาแก้ไฟล์แอปแล้วอยากให้เครื่องนักเรียนอัปเดต ให้เปลี่ยนเลข VERSION ข้างล่างนี้
   (เช่น v1 → v2) แล้วอัปโหลดใหม่ทั้งโฟลเดอร์ เท่านี้ทุกเครื่องจะเห็นของใหม่เอง */
const VERSION = "v17";

const CACHE = "nst18-" + VERSION;
const SHELL = [
  "./",
  "./index.html",
  "./questions.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
];

// ฟอนต์จาก Google — เก็บลงแคชไว้ใช้ตอนออฟไลน์
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return;

  // หน้าเว็บหลัก: ถ้ามีเน็ตเอาของใหม่เสมอ (จะได้เห็นข้อมูลที่อัปเดต) ถ้าไม่มีเน็ตใช้ของในแคช
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // คลังข้อสอบ: ถ้ามีเน็ตเอาของใหม่เสมอ (ติวเตอร์อาจเพิ่งอัปข้อสอบชุดใหม่) ไม่มีเน็ตใช้ของในแคช
  if (url.pathname.endsWith("questions.json")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./questions.json", copy));
          }
          return res;
        })
        .catch(() => caches.match("./questions.json"))
    );
    return;
  }

  // ไฟล์อื่น (ไอคอน/ฟอนต์): ใช้ของในแคชก่อนเพื่อความไว แล้วค่อยดึงของใหม่มาเก็บไว้เงียบ ๆ
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

FAVICON PACKS — Clearframe (root) + Proximity (/proximity/)
----------------------------------------------------------
Goal: Fix Chrome New Tab shortcut icons + tab favicons using icon-only assets (no wordmark).

1) Copy Clearframe root files to your domain root:
   /favicon.ico
   /favicon-32.png
   /favicon-16.png
   /apple-touch-icon.png
   /icon-192.png
   /icon-512.png
   /site.webmanifest

2) Copy Proximity files into /proximity/:
   /proximity/favicon.ico
   /proximity/favicon-32.png
   /proximity/favicon-16.png
   /proximity/apple-touch-icon.png
   /proximity/icon-192.png
   /proximity/icon-512.png
   /proximity/site.webmanifest

3) Add these tags to the <head> of the root index.html:
   <link rel="icon" href="/favicon.ico">
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   <link rel="manifest" href="/site.webmanifest">
   <meta name="theme-color" content="#0b1320">

4) Add these tags to the <head> of /proximity/index.html:
   <link rel="icon" href="/proximity/favicon.ico">
   <link rel="icon" type="image/png" sizes="32x32" href="/proximity/favicon-32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="/proximity/favicon-16.png">
   <link rel="apple-touch-icon" href="/proximity/apple-touch-icon.png">
   <link rel="manifest" href="/proximity/site.webmanifest">
   <meta name="theme-color" content="#1e5f2c">

After push: open each page, hard refresh (Ctrl+Shift+R). If the shortcut icon still shows old cache, delete the shortcut and re-add it.

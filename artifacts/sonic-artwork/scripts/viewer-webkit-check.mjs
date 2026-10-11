import { createServer } from 'node:http';
import { webkit } from 'playwright';

export async function checkWebKit(importMapMarkup, entry) {
  // An isolated document carries only the validated production import map.
  // It never loads the app, Clerk, an image target, or MindAR's camera startup.
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!doctype html><html><head>${importMapMarkup}</head><body>Viewer dependency probe</body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    try {
      browser = await webkit.launch();
    } catch (error) {
      throw new Error(`WebKit could not launch. Run "pnpm exec playwright install webkit" in this package and provision Playwright's WebKit system libraries on a supported host; this is not a passed browser check. ${error.message}`);
    }
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    page.setDefaultTimeout(120_000);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => {
      window.__cameraRequests = 0;
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = () => {
          window.__cameraRequests++;
          throw new Error('Camera access is forbidden in the dependency probe.');
        };
      }
    });
    // Real network responses and native WebKit import resolution, not a bundle
    // or fulfilled mock routes. Merely importing does not construct MindARThree.
    const result = await Promise.race([
      page.evaluate(async url => {
        try {
          const module = await import(url);
          return { exported: typeof module.MindARThree, cameraRequests: window.__cameraRequests };
        } catch (error) {
          return { error: error.message };
        }
      }, entry),
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('WebKit native import timed out after 120 seconds. Check CDN access.')), 120_000);
        timer.unref();
      }),
    ]);
    if (result.error || result.exported !== 'function' || result.cameraRequests !== 0) {
      throw new Error(`WebKit native import failed: ${JSON.stringify(result)}. Check production import-map mappings and CDN JavaScript responses.`);
    }
    console.log('PASS: WebKit natively imported MindARThree without requesting camera access.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

import puppeteer, { Browser, PDFOptions } from 'puppeteer-core';

let browserInstance: Browser | null = null;

interface PDFGeneratorOptions {
  format?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  printBackground?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  scale?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

const defaultOptions: PDFGeneratorOptions = {
  format: 'A4',
  landscape: false,
  printBackground: true,
  margin: {
    top: '20mm',
    right: '20mm',
    bottom: '20mm',
    left: '20mm',
  },
  scale: 1,
};

function getChromiumPath(): string {
  // Check for environment variable first (Docker/production)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Platform-specific paths for local development
  const platform = process.platform;

  switch (platform) {
    case 'linux':
      // Common Linux paths
      const linuxPaths = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
      ];
      for (const p of linuxPaths) {
        try {
          require('fs').accessSync(p);
          return p;
        } catch {
          continue;
        }
      }
      break;
    case 'darwin':
      // macOS paths
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ];
      for (const p of macPaths) {
        try {
          require('fs').accessSync(p);
          return p;
        } catch {
          continue;
        }
      }
      break;
    case 'win32':
      // Windows paths
      const winPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ];
      for (const p of winPaths) {
        try {
          require('fs').accessSync(p);
          return p;
        } catch {
          continue;
        }
      }
      break;
  }

  throw new Error(
    'Chromium not found. Please install Chromium or set PUPPETEER_EXECUTABLE_PATH environment variable.'
  );
}

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const executablePath = getChromiumPath();

  browserInstance = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-software-rasterizer',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
    ],
  });

  return browserInstance;
}

export async function generatePDFFromHTML(
  html: string,
  options: PDFGeneratorOptions = {}
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Set content with wait for network idle
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000,
    });

    // Merge options with defaults
    const pdfOptions: PDFOptions = {
      ...defaultOptions,
      ...options,
      margin: {
        ...defaultOptions.margin,
        ...options.margin,
      },
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

export async function generatePDFFromURL(
  url: string,
  options: PDFGeneratorOptions = {}
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Navigate to URL
    await page.goto(url, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000,
    });

    // Merge options with defaults
    const pdfOptions: PDFOptions = {
      ...defaultOptions,
      ...options,
      margin: {
        ...defaultOptions.margin,
        ...options.margin,
      },
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Cleanup on process exit
process.on('exit', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

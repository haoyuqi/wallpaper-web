import { expect, test, type Page } from "@playwright/test";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function buildRecord(index: number, sourceDate: string) {
  return {
    id: `bing-${sourceDate}-${index}`,
    source: "bing",
    market: "en-US",
    sourceDate,
    title: `Alpine Ridge ${index + 1}`,
    copyright: `© Photographer ${index + 1} / Agency`,
    copyrightLink: `https://images.example.test/credit/${index + 1}`,
    imageUrl: `https://images.example.test/photos/${index + 1}.png`,
    downloadUrl: index === 1 ? null : `https://images.example.test/downloads/${index + 1}.png`,
  };
}

async function mockWallpaperNetwork(page: Page) {
  await page.route("https://images.example.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: ONE_PIXEL_PNG,
    });
  });

  await page.route("**/api/v1/wallpapers*", async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get("date");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (date === "2026-01-01") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { count: 0, query: { date, from: null, to: null } },
        }),
      });
      return;
    }

    if (date) {
      const record = buildRecord(0, date);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [record],
          meta: { count: 1, query: { date, from: null, to: null } },
        }),
      });
      return;
    }

    const baseDate = to ?? "2026-10-18";
    const records = Array.from({ length: 14 }, (_, index) => buildRecord(index, baseDate));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: records,
        meta: { count: records.length, query: { date: null, from, to } },
      }),
    });
  });
}

test.describe("Wallpaper archive E2E flows", () => {
  test.use({ locale: "zh-CN" });
  test("renders initial 6 cards, appends batches with keyboard focus and reaches range end", async ({
    page,
  }) => {
    await mockWallpaperNetwork(page);
    await page.goto("/");

    await expect(page.locator("#cover-title")).toHaveText("Alpine Ridge 1");
    await expect(page.locator("#cover-position")).toHaveText("01 / 08");
    await expect(page.locator(".wallpaper-card")).toHaveCount(6);

    const loadMoreBtn = page.getByRole("button", { name: "加载更多" });
    await loadMoreBtn.focus();
    await page.keyboard.press("Enter");

    await expect(page.locator(".wallpaper-card")).toHaveCount(12);
    const seventhCardButton = page.locator(".wallpaper-card .card-image").nth(6);
    await expect(seventhCardButton).toBeFocused();

    await loadMoreBtn.click();
    await expect(page.locator(".wallpaper-card")).toHaveCount(14);
    await expect(loadMoreBtn).toBeHidden();
    await expect(page.locator(".collection-end")).toContainText(
      "当前范围已全部显示，可按日期查找其他壁纸",
    );
  });

  test("synchronizes date filter with URL, handles empty date, back navigation and invalid URL", async ({
    page,
  }) => {
    await mockWallpaperNetwork(page);
    await page.goto("/");
    await expect(page.locator(".wallpaper-card")).toHaveCount(6);

    const dateInput = page.locator("#date-filter");
    await dateInput.fill("2026-10-17");
    await dateInput.dispatchEvent("change");

    await expect(page).toHaveURL(/\/\?date=2026-10-17$/);
    await expect(page.locator(".archive-scope")).toHaveText("2026年10月17日");
    await expect(page.locator(".wallpaper-card")).toHaveCount(1);
    await expect(page.locator("#cover-title")).toHaveText("Alpine Ridge 1");

    await dateInput.fill("2026-01-01");
    await dateInput.dispatchEvent("change");
    await expect(page).toHaveURL(/\/\?date=2026-01-01$/);
    await expect(page.locator(".empty-state h3")).toHaveText("这一天没有壁纸");

    await page.getByRole("button", { name: /查看全部壁纸/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".wallpaper-card")).toHaveCount(6);

    await page.goBack();
    await expect(page).toHaveURL(/\/\?date=2026-01-01$/);
    await expect(dateInput).toHaveValue("2026-01-01");

    await page.goto("/?date=2026-02-30");
    await expect(page.locator("#date-error")).toHaveText("请选择有效日期。");
  });

  test("handles initial request errors and rate-limit Retry-After countdown recovery", async ({
    page,
  }) => {
    let attempts = 0;
    await page.route("https://images.example.test/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG });
    });
    await page.route("**/api/v1/wallpapers*", async (route) => {
      attempts++;
      const url = new URL(route.request().url());
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (attempts <= 2) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          headers: { "Retry-After": "1" },
          body: JSON.stringify({ error: { code: "TOO_MANY_REQUESTS", message: "Rate limited" } }),
        });
        return;
      }
      const record = buildRecord(0, to ?? "2026-10-18");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [record],
          meta: { count: 1, query: { date: null, from, to } },
        }),
      });
    });

    await page.goto("/");
    await expect(page.locator(".empty-state h3")).toHaveText("请求有些频繁");
    const retryBtn = page.locator(".empty-state button");
    await expect(retryBtn).toBeEnabled({ timeout: 5000 });
    await retryBtn.click();
    await expect(page.locator(".wallpaper-card")).toHaveCount(1);
  });

  test("opens single-object viewer from all 3 entries, traps focus, downloads and restores focus", async ({
    page,
  }) => {
    await mockWallpaperNetwork(page);
    await page.goto("/");

    const entries = [
      { locator: page.locator(".hero-image-button"), expectedTitle: "Alpine Ridge 1" },
      {
        locator: page.locator(".wallpaper-card .card-image").first(),
        expectedTitle: "Alpine Ridge 1",
      },
      {
        locator: page.locator(".wallpaper-card h3 button").nth(1),
        expectedTitle: "Alpine Ridge 2",
      },
    ];

    for (const entry of entries) {
      await entry.locator.focus();
      await entry.locator.click();

      const dialog = page.locator("dialog.wallpaper-viewer[open]");
      await expect(dialog).toBeVisible();
      await expect(page.locator("#detail-title")).toHaveText(entry.expectedTitle);

      const closeBtn = dialog.getByRole("button", { name: "关闭壁纸" });
      await expect(closeBtn).toBeFocused();

      await page.keyboard.press("ArrowRight");
      await expect(page.locator("#detail-title")).toHaveText(entry.expectedTitle);

      await page.keyboard.press("Shift+Tab");
      await expect(dialog.locator(".detail-foot a")).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(closeBtn).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(entry.locator).toBeFocused();
    }

    await page.locator(".hero-image-button").click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-download]").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^wallpaper-\d{4}-\d{2}-\d{2}\.png$/);
    await expect(page.locator(".download-message")).toHaveText("已交给浏览器保存");
    await page.keyboard.press("Escape");
  });

  test("adapts responsive grid columns and landscape viewer layout without horizontal overflow", async ({
    page,
  }) => {
    await mockWallpaperNetwork(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator(".wallpaper-card")).toHaveCount(6);

    const checkViewport = async (width: number, height: number, expectedCols: number) => {
      await page.setViewportSize({ width, height });
      const metrics = await page.evaluate(() => {
        const grid = document.querySelector(".wallpaper-grid");
        const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
        return {
          cols,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(metrics.cols).toBe(expectedCols);
      expect(metrics.overflow).toBe(false);
    };

    await checkViewport(1440, 900, 3);
    await checkViewport(768, 1024, 2);
    await checkViewport(390, 844, 1);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator(".hero-image-button").click();
    await expect(page.locator("dialog.wallpaper-viewer[open]")).toBeVisible();
    const flexDirection = await page
      .locator(".detail-body")
      .evaluate((el) => getComputedStyle(el).flexDirection);
    expect(flexDirection).toBe("row");
  });
});

test.describe("Language preferences and switching", () => {
  test.use({ locale: "en-US", timezoneId: "America/Los_Angeles" });

  test("detects English, switches without requests or resets, and persists a manual preference", async ({
    page,
  }) => {
    await mockWallpaperNetwork(page);
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/wallpapers")) requests++;
    });
    await page.goto("/");
    await expect(page.locator(".wallpaper-card")).toHaveCount(6);
    await expect(page.locator("#cover-title")).toHaveText("Alpine Ridge 1");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveTitle("Wallpapers · Bing Image Archive");
    const language = page.getByRole("combobox", { name: "Language", exact: true });
    await expect(language.locator("option")).toHaveCount(2);
    await language.focus();
    await expect(language).toBeFocused();
    await page.getByRole("button", { name: "Load more", exact: true }).click();
    await expect(page.locator(".wallpaper-card")).toHaveCount(12);
    await expect(page.getByRole("status").filter({ hasText: "Added 6 wallpapers." })).toHaveCount(
      1,
    );
    const initialRequests = requests;
    await language.selectOption("zh-CN");
    await expect(page.locator("#collection-title")).toHaveText("全部壁纸");
    await expect(page.locator(".wallpaper-card")).toHaveCount(12);
    await expect(page.getByRole("status").filter({ hasText: "已追加 6 张壁纸。" })).toHaveCount(1);
    expect(requests).toBe(initialRequests);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("combobox", { name: "语言", exact: true })).toHaveValue("zh-CN");
    await page.getByRole("combobox").selectOption("en");
    await page.locator("#date-filter").fill("2026-10-17");
    await page.locator("#date-filter").dispatchEvent("change");
    await expect(page.locator(".archive-scope")).toHaveText("Oct 17, 2026");
    await expect(page.locator(".wallpaper-card")).toHaveCount(1);
    const filteredRequests = requests;
    await page.getByRole("combobox").selectOption("zh-CN");
    await expect(page.locator(".archive-scope")).toHaveText("2026年10月17日");
    await expect(page).toHaveURL(/\?date=2026-10-17$/);
    expect(requests).toBe(filteredRequests);
    await expect(page.locator(".wallpaper-card h3")).toHaveText("Alpine Ridge 1");
  });

  test("keeps an open viewer and download status translated without changing source content", async ({
    page,
  }) => {
    await mockWallpaperNetwork(page);
    await page.goto("/");
    await page.locator(".hero-image-button").click();
    await expect(page.getByRole("button", { name: "Close wallpaper", exact: true })).toBeFocused();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-download]").click();
    await downloadPromise;
    await expect(page.locator(".download-message")).toHaveText("Handed to your browser to save");
    await page.locator("[data-download]").focus();
    // A native modal makes the header inert; exercise a programmatic locale change while it is open.
    await page.locator(".language-select select").evaluate((select: HTMLSelectElement) => {
      select.value = "zh-CN";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(page.locator(".download-message")).toHaveText("已交给浏览器保存");
    await expect(page.locator("#detail-title")).toHaveText("Alpine Ridge 1");
    await expect(page.locator(".detail-foot")).toContainText("© Photographer 1 / Agency");
    await expect(page.locator("[data-download]")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".hero-image-button")).toBeFocused();
  });

  test("matches browser language preferences in order", async ({ page }) => {
    await mockWallpaperNetwork(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { value: ["fr-FR", "zh-SG", "en-US"] });
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  });

  test("fits both languages at mobile, tablet, desktop and landscape widths", async ({ page }) => {
    await mockWallpaperNetwork(page);
    await page.goto("/");
    await expect(page.locator(".wallpaper-card")).toHaveCount(6);
    for (const locale of ["en", "zh-CN"]) {
      await page.getByRole("combobox").selectOption(locale);
      for (const [width, height] of [
        [320, 844],
        [390, 844],
        [700, 900],
        [701, 900],
        [768, 1024],
        [1120, 900],
        [1121, 900],
        [1440, 900],
        [1920, 1080],
        [844, 390],
      ] as const) {
        await page.setViewportSize({ width, height });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        const select = page.getByRole("combobox");
        await expect(select).toBeVisible();
        const bounds = await select.boundingBox();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      }
    }
  });
});

test.describe("Unsupported browser language", () => {
  test.use({ locale: "fr-FR" });
  test("falls back to English on first visit", async ({ page }) => {
    await mockWallpaperNetwork(page);
    await page.goto("/");
    await expect(page.locator("#collection-title")).toHaveText("All wallpapers");
    await expect(page.getByRole("combobox", { name: "Language", exact: true })).toHaveValue("en");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Browse Bing wallpapers/,
    );
  });
});

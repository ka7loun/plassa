import { expect, test } from "@playwright/test";

test.describe("driver", () => {
  test("finds a free spot near Bab Bhar and books it with cash", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("demo-driver").click();
    await expect(page).toHaveURL(/\/find/);

    // 3h from tomorrow's default keeps clear of other tests' bookings
    await page.getByTestId("dur-3").click();
    const free = page.locator('[data-testid="spot-card"][data-available="1"]').first();
    await expect(free).toBeVisible();
    await expect(page.getByTestId("map-pin").first()).toBeVisible();
    await free.click();

    await expect(page.getByTestId("spot-title")).toBeVisible();
    await expect(page.getByTestId("private-badge")).toBeVisible();
    await page.getByLabel(/Immatriculation/).fill("215 TU 4821");
    await page.getByTestId("book").click();

    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?new=1/);
    await expect(page.getByTestId("confirmed")).toBeVisible();
    await expect(page.getByTestId("checkin-code")).toHaveText(/^\d{4}$/);
    await page.screenshot({ path: "docs/tests/screens/driver-confirmation.png" });

    // cancel frees the slot
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("cancel").click();
    await expect(page.getByTestId("status")).toHaveText(/Annulée/);
  });

  test("pays with a simulated wallet, and a declined payment releases the slot", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("demo-driver").click();
    await expect(page).toHaveURL(/\/find/);
    await page.getByTestId("dur-1").click();
    await page.locator('[data-testid="spot-card"][data-available="1"]').nth(1).click();
    await page.getByTestId("pay-flouci").check({ force: true });
    await page.getByTestId("book").click();

    await expect(page).toHaveURL(/\/pay\//);
    await expect(page.getByTestId("pay-amount")).toContainText("DT");
    await page.getByTestId("pay-decline").click();
    await expect(page.getByText(/Paiement refusé/)).toBeVisible();

    await page.goBack();
    await page.getByTestId("pay-flouci").check({ force: true });
    await page.getByTestId("book").click();
    await page.getByTestId("pay-approve").click();
    await expect(page.getByTestId("confirmed")).toBeVisible();
  });

  test("switches to Arabic with a right-to-left layout", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("lang-ar").click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.getByTestId("demo-driver")).toContainText("لوّج على بلاصة");
    await page.reload(); // choice persists in a cookie, server renders RTL
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.screenshot({ path: "docs/tests/screens/landing-ar.png" });
    await page.getByTestId("lang-fr").click();
  });

  test("has no horizontal scroll on a phone", async ({ page }) => {
    for (const path of ["/", "/find"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

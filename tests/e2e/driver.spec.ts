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
    // each host picks the payment methods they accept: open free spots until one takes Flouci
    const cards = page.locator('[data-testid="spot-card"][data-available="1"]');
    await expect(cards.first()).toBeVisible();
    for (let i = 0; ; i++) {
      expect(i, "a free spot that accepts Flouci").toBeLessThan(10);
      await cards.nth(i).click();
      await expect(page.getByTestId("book")).toBeVisible();
      if ((await page.getByTestId("pay-flouci").count()) > 0) break;
      await page.goBack();
    }
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
    await expect(page.getByTestId("cta-find")).toContainText("لوّج على بلاصة");
    await page.reload(); // choice persists in a cookie, server renders RTL
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.screenshot({ path: "docs/tests/screens/landing-ar.png" });
    await page.getByTestId("lang-fr").click();
  });

  test("a visitor signs up, then books with the new account", async ({ page }) => {
    // guests can browse; booking asks them to sign in and brings them back
    await page.goto("/find");
    await page.getByTestId("dur-2").click();
    await page.locator('[data-testid="spot-card"][data-available="1"]').first().click();
    await expect(page.getByTestId("book")).toHaveText(/Se connecter pour réserver/);
    await page.getByTestId("book").click();
    await expect(page).toHaveURL(/\/login\?next=/);

    await page.getByRole("link", { name: "Créer un compte" }).last().click();
    await expect(page).toHaveURL(/\/signup\?next=/);
    const phone = `9${String(Date.now()).slice(-7)}`;
    await page.getByTestId("auth-name").fill("Test Signup");
    await page.getByTestId("auth-phone").fill(phone);
    await page.getByTestId("auth-password").fill("motdepasse-e2e");
    await page.getByTestId("auth-submit").click();

    await expect(page).toHaveURL(/\/spot\//);
    await expect(page.getByTestId("book")).toHaveText(/Réserver/);

    await page.goto("/me");
    await expect(page.getByTestId("level-name")).toHaveText("Débutant");
    await expect(page.getByTestId("badges-driver")).toBeVisible();
    await page.screenshot({ path: "docs/tests/screens/profile-new.png" });

    // the same phone cannot sign up twice; logging in with it works
    await page.context().clearCookies();
    await page.goto("/signup");
    await page.getByTestId("auth-name").fill("Doublon");
    await page.getByTestId("auth-phone").fill(phone);
    await page.getByTestId("auth-password").fill("motdepasse-e2e");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Un compte utilise déjà ce numéro.")).toBeVisible();
    await page.goto("/login");
    await page.getByTestId("auth-phone").fill(phone);
    await page.getByTestId("auth-password").fill("motdepasse-e2e");
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/find/);
  });

  test("the demo driver sees points, badges and stays to rate, and rates one", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("demo-driver").click();
    await expect(page).toHaveURL(/\/find/);
    await page.goto("/me");
    await expect(page.getByTestId("level-card")).toBeVisible();
    await expect(page.locator('[data-testid="badges-driver"] [data-earned="1"]').first()).toBeVisible();
    const toReview = page.getByTestId("to-review");
    const before = await toReview.getByTestId("review-form").count();
    expect(before).toBeGreaterThan(0);
    await toReview.getByTestId("star-5").first().click();
    await toReview.getByTestId("review-send").first().click();
    await expect(toReview.getByTestId("review-form")).toHaveCount(before - 1);
    await page.screenshot({ path: "docs/tests/screens/profile-driver.png", fullPage: true });

    await page.goto("/top");
    await expect(page.getByTestId("top-spots").locator("li")).toHaveCount(10);
  });

  test("has no horizontal scroll on a phone", async ({ page }) => {
    for (const path of ["/", "/find", "/top", "/login"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});

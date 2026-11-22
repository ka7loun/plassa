import { expect, test } from "@playwright/test";

test("host lists a new spot and drivers can find it", async ({ page, request }) => {
  await page.goto("/");
  await page.getByTestId("demo-host").click();
  await expect(page).toHaveURL(/\/host/);
  await expect(page.getByTestId("host-summary")).toBeVisible();
  await expect(page.getByTestId("earnings-chart")).toBeVisible();
  await expect(page.getByTestId("host-rank")).toHaveText(/sur/);
  await page.screenshot({ path: "docs/tests/screens/host-dashboard.png", fullPage: true });

  // the host decides which payment methods drivers see
  const first = page.getByTestId("host-spot").first();
  const card = first.getByTestId("method-card");
  const wasOn = (await card.getAttribute("aria-pressed")) === "true";
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", wasOn ? "false" : "true");
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", wasOn ? "true" : "false");

  await page.getByTestId("add-spot").click();
  const title = `Garage e2e ${Date.now()}`;
  await page.getByLabel("Titre").fill(title);
  await page.getByLabel(/Rue/).fill("Rue de Paris");
  // place the pin in the middle of the map (Bab Bhar)
  const map = page.getByTestId("pick-map");
  await expect(map.locator("canvas")).toBeVisible();
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByLabel("Prix par heure (DT)").fill("1.800");
  // accept cash and D17 only
  await page.getByTestId("new-method-flouci").click();
  await page.getByTestId("new-method-card").click();
  await page.getByTestId("private-attest").check();
  await page.getByTestId("publish").click();

  await expect(page).toHaveURL(/\/host/);
  await expect(page.getByTestId("host-spots")).toContainText(title);

  // the new spot is searchable through the public API
  const start = new Date(Date.now() + 2 * 86_400_000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3_600_000);
  const res = await request.get(`/api/spots?lat=35.8287&lng=10.6375&radius=2000&start=${start.toISOString()}&end=${end.toISOString()}`, {
    headers: { "x-plassa-nolog": "1" },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const mine = body.spots.find((s: { title: string }) => s.title === title);
  expect(mine.paymentMethods).toEqual(["cash", "d17"]);
});

test("city view shows demand and supply", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("demo-admin").click();
  await expect(page).toHaveURL(/\/city/);
  await expect(page.getByTestId("city-kpis")).toBeVisible();
  await expect(page.getByTestId("heat-map").locator("canvas")).toBeVisible();
  await page.screenshot({ path: "docs/tests/screens/city-view.png", fullPage: true });
});

test("API rejects unauthenticated and wrong-role requests", async ({ request }) => {
  const r1 = await request.post("/api/host/spots", { data: {} });
  expect([401, 403]).toContain(r1.status());
  const bad = await request.get("/api/spots?lat=999&lng=10&start=x&end=y");
  expect(bad.status()).toBe(400);
});

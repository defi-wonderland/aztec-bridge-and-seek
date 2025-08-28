import { test, expect, Page, TestInfo } from '@playwright/test';

async function waitForAppReady(page: Page) {
  const connectButton = await page.locator('#connect-test-account');
  await expect(connectButton).toBeVisible({ timeout: 30000 });
}

async function connectTestAccount(page: Page, testInfo: TestInfo) {
  const selectTestAccount = await page.locator('#test-account-number');
  await expect(selectTestAccount).toBeVisible();

  // Select different account for each browser to avoid conflicts
  const testAccountNumber = {
    'chromium': 1,
    'firefox': 2,
    'webkit': 3,
  }[testInfo.project.name];
  
  await selectTestAccount.selectOption(testAccountNumber.toString());
  
  const connectButton = await page.locator('#connect-test-account');
  await connectButton.click();
  
  await page.waitForTimeout(2000);
}

async function disconnectAccount(page: Page) {
  const disconnectButton = await page.locator('.disconnect-button');
  await disconnectButton.click();
  await expect(disconnectButton).not.toBeVisible();
}

async function waitForAccountConnected(page: Page) {
  const accountDisplay = await page.locator('#account-display');
  await expect(accountDisplay).toBeVisible({ timeout: 30000 });
  await expect(accountDisplay).toHaveText(/Account: 0x[a-fA-F0-9]{4}/);
}

test('app loads with correct title and basic structure', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Bridge and Seek/);
  
  const header = await page.locator('.navbar');
  await expect(header).toBeVisible();
  
  const title = await page.locator('.nav-title');
  await expect(title).toHaveText('Bridge and Seek');
});

test('app shows connection options when not connected', async ({ page }) => {
  await page.goto('/');
  
  await waitForAppReady(page);
  
  const selectTestAccount = await page.locator('#test-account-number');
  await expect(selectTestAccount).toBeVisible();
  
  const connectButton = await page.locator('#connect-test-account');
  await expect(connectButton).toBeVisible();
  
  const createAccountButton = await page.locator('button:has-text("Create Account")');
  await expect(createAccountButton).toBeVisible();
});

test('can connect test account successfully', async ({ page }, testInfo) => {
  await page.goto('/');
  
  await waitForAppReady(page);
  await connectTestAccount(page, testInfo);
  await waitForAccountConnected(page);
  await disconnectAccount(page);
  await waitForAppReady(page);
});

test('main app features appear after account connection', async ({ page }, testInfo) => {
  await page.goto('/');
  
  await waitForAppReady(page);
  await connectTestAccount(page, testInfo);
  await waitForAccountConnected(page);
  
  const layoutContainer = await page.locator('.layout-container');
  await expect(layoutContainer).toBeVisible({ timeout: 30000 });
  
  const tabs = await page.locator('.tab-trigger');
  await expect(tabs).toHaveCount(2);
  
  const mintTab = await page.locator('.tab-trigger:first-child');
  await expect(mintTab).toHaveText(/Mint Tokens/);
  
  const dripperCard = await page.locator('.dripper-content');
  await expect(dripperCard).toBeVisible();
  
  const disconnectButton = await page.locator('.disconnect-button');
  await expect(disconnectButton).toBeVisible();
});
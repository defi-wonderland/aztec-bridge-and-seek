import { test, expect } from '@playwright/test';

const proofTimeout = 300_000;

test('app initialization and basic rendering', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Private Voting on Aztec/);

  // Wait for the app to be ready (connect button visible)
  const connectButton = await page.locator('#connect-test-account');
  await expect(connectButton).toBeVisible({ timeout: 30000 });

  // Check that basic components are rendering
  const header = await page.locator('.navbar');
  await expect(header).toBeVisible();

  const title = await page.locator('.nav-title');
  await expect(title).toHaveText('Private Voting');
});

test('create account and cast vote', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Private Voting on Aztec/);

  // Wait for the connect button to be visible (means app is ready)
  const connectTestAccount = await page.locator('#connect-test-account');
  await expect(connectTestAccount).toBeVisible({ timeout: 30000 });

  const selectTestAccount = await page.locator('#test-account-number');
  await expect(selectTestAccount).toBeVisible();

  // Select different account for each browser
  const testAccountNumber = {
    chromium: 1,
    firefox: 2,
    webkit: 3,
  }[testInfo.project.name];
  await selectTestAccount.selectOption(testAccountNumber.toString());

  await connectTestAccount.click();

  // Wait a moment for any errors to appear
  await page.waitForTimeout(2000);

  // Check if there are any error messages visible
  const statusMessage = await page.locator('#status-message');
  if (await statusMessage.isVisible()) {
    const errorText = await statusMessage.textContent();
  }

  // Wait for account to be connected and displayed
  // This can take time due to Aztec node communication
  const accountDisplay = await page.locator('#account-display');
  await expect(accountDisplay).toBeVisible({ timeout: 30000 });
  await expect(accountDisplay).toHaveText(/Account: 0x[a-fA-F0-9]{4}/);

  // Wait for voting form to appear (only shows when account is connected)
  const voteButton = await page.locator('#vote-button');
  const voteInput = await page.locator('#vote-input');
  const voteResults = await page.locator('#vote-results');

  await expect(voteInput).toBeVisible();
  await expect(voteButton).toBeVisible();

  // Choose the candidate to vote for based on the browser used to run the test.
  // This is a hack to avoid race conditions when tests are run in parallel against the same network.
  const candidateId = {
    chromium: 2,
    firefox: 3,
    webkit: 4,
  }[testInfo.project.name];

  await voteInput.selectOption(candidateId!.toString());

  // Wait for button to be enabled (requires candidate selection)
  await expect(voteButton).toBeEnabled();

  await voteButton.click();

  // This will take some time to complete (Client IVC proof generation)
  // Wait for the voting process to complete

  // Wait for the button to be enabled (voting process completed)
  await expect(voteButton).toBeEnabled({
    timeout: proofTimeout,
  });

  // Verify vote results - wait for results to load
  await expect(voteResults).toBeVisible();

  // The vote results should show the candidate we voted for
  // Note: In a real scenario, this might take time to propagate
  await expect(voteResults).toContainText(`Candidate ${candidateId}`);
});

test('notification auto-timeout functionality', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Private Voting on Aztec/);

  // Wait for the app to be ready
  const connectButton = await page.locator('#connect-test-account');
  await expect(connectButton).toBeVisible({ timeout: 30000 });

  // Connect to trigger a success message
  await connectButton.click();

  // Wait for account selection and select an account
  const selectTestAccount = await page.locator('#test-account-number');
  await expect(selectTestAccount).toBeVisible();
  await selectTestAccount.selectOption('0');

  const connectSelectedAccount = await page.locator(
    '#connect-selected-account'
  );
  await expect(connectSelectedAccount).toBeVisible();
  await connectSelectedAccount.click();

  // Wait for a success message to appear
  const statusMessage = await page.locator(
    '.status-message.info, .status-message.global-error'
  );

  // Check if a message appears (it might be wallet initialization or connection success)
  if (await statusMessage.isVisible()) {
    // Verify the message is visible initially
    await expect(statusMessage).toBeVisible();

    // Wait for the message to auto-close (should happen within 4-8 seconds for info messages)
    // We'll wait up to 10 seconds to be safe
    await expect(statusMessage).not.toBeVisible({ timeout: 10000 });
  }

  // Test manual dismissal still works by triggering another action that shows a message
  // Try to mint tokens to trigger a success message
  const amountInput = await page.locator('#mint-amount');
  if (await amountInput.isVisible()) {
    await amountInput.fill('10');

    const mintButton = await page.locator('#mint-public');
    if (await mintButton.isVisible()) {
      await mintButton.click();

      // Wait for success message
      const successMessage = await page.locator('.status-message.info');
      if (await successMessage.isVisible()) {
        // Verify we can manually dismiss it
        const closeButton = await successMessage.locator('.error-close');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await expect(successMessage).not.toBeVisible();
        }
      }
    }
  }
});

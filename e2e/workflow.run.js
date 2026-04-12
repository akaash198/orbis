async (page) => {
  const expectVisible = async (locator, timeout = 30000) => {
    await locator.waitFor({ state: 'visible', timeout });
  };

  // Login
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('testuser or your@company.com').fill('testuser');
  await page.getByPlaceholder('Enter your password').fill('password123');
  await Promise.all([
    page.waitForURL('http://localhost:3000/', { timeout: 30_000 }),
    page.getByRole('button', { name: 'Sign In to Orbisporté' }).click(),
  ]);
  await expectVisible(page.getByRole('heading', { name: 'Control Tower' }), 30_000);

  // Documents: upload + extract essential fields (M02)
  await page.getByRole('button', { name: /Upload Doc/i }).click();
  await expectVisible(page.getByRole('heading', { name: /Repository, upload, and AI extraction/i }), 30_000);

  await page.getByRole('button', { name: 'Upload Documents' }).click();
  await page.setInputFiles('#document-upload-input', 'output/playwright/fixtures/e2e-invoice.pdf');
  await expectVisible(page.getByRole('button', { name: /Upload 1 File/i }), 30_000);
  await page.getByRole('button', { name: /Upload 1 File/i }).click();

  // Back in repository mode, locate the uploaded doc and open extraction modal
  await expectVisible(page.getByText('Repository Health'), 120_000);
  const uploadedName = page.locator('p:visible', { hasText: 'e2e-invoice.pdf' }).first();
  await expectVisible(uploadedName, 60_000);
  const tableRow = page.locator('tr', { has: uploadedName }).first();
  const mobileCard = page.locator('article', { has: uploadedName }).first();
  if (await tableRow.count()) {
    await tableRow.getByRole('button', { name: 'Extract' }).first().click();
  } else {
    await mobileCard.getByRole('button', { name: 'Extract' }).first().click();
  }
  const dialog = page.getByRole('dialog');
  await expectVisible(dialog, 30_000);
  await page.screenshot({ path: 'output/playwright/extraction-modal.png', fullPage: true });
  if (await dialog.getByText('AI extraction is only available for documents saved in the system.').isVisible().catch(() => false)) {
    throw new Error('Extraction modal entered demo mode (document ID missing). See output/playwright/extraction-modal.png.');
  }
  const downloadJson = page.getByRole('button', { name: 'Download JSON' });
  const extractionFailed = page.getByText(/Extraction timed out|Extraction failed/i);
  let extractionOutcome = null;
  try {
    extractionOutcome = await Promise.race([
      downloadJson.waitFor({ state: 'visible', timeout: 420_000 }).then(() => 'ok'),
      extractionFailed.waitFor({ state: 'visible', timeout: 420_000 }).then(() => 'error'),
    ]);
  } catch (e) {
    await page.screenshot({ path: 'output/playwright/extraction-timeout.png', fullPage: true });
    throw new Error('Extraction did not finish within 7 minutes (see output/playwright/extraction-timeout.png).');
  }
  if (extractionOutcome !== 'ok') {
    await page.screenshot({ path: 'output/playwright/extraction-failed.png', fullPage: true });
    throw new Error('Extraction did not complete successfully (see output/playwright/extraction-failed.png).');
  }
  await dialog.getByRole('button', { name: /^Close$/ }).click();

  // HS Code lookup: search and save/use -> navigates to Duty Calculator
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: /^HS Code Lookup$/ })
    .click();
  await expectVisible(page.getByRole('heading', { name: 'Product Description' }), 30_000);
  await page.getByPlaceholder("Enter detailed product description (e.g., 'Electronic computer components for data processing')").fill('Laptop computer for data processing');
  await page.getByRole('button', { name: /Fast Search|Detailed Search/ }).click();
  await expectVisible(page.getByText('HSN Code Found'), 60_000);
  await page.getByRole('button', { name: /Save to Registry/i }).first().click();

  // Duty calculator: fill FOB (HSN should be prefilled) + calculate
  await expectVisible(page.locator('#main-content').getByRole('heading', { name: 'Duty Calculator' }), 30_000);
  const fobInput = page.locator('label', { hasText: 'FOB Cost' }).locator('..').locator('..').locator('input').first();
  await fobInput.fill('1000');
  const currencySelect = page.locator('label', { hasText: 'Currency' }).locator('..').locator('..').locator('select').first();
  await currencySelect.selectOption({ label: /^INR\b/ }).catch(async () => {
    await currencySelect.selectOption('INR');
  });
  await page.getByRole('button', { name: 'Calculate Duty' }).click();
  await expectVisible(page.getByText('Total Customs Duty'), 60_000);

  // BoE Filing page loads
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: /^BoE Filing$/ })
    .click();
  await expectVisible(page.getByRole('heading', { name: /BoE Filing|BOE Filing|Bill of Entry/i }).first(), 30_000);

  // Backend swagger reachable
  const api = await page.context().newPage();
  await api.goto('http://127.0.0.1:8000/docs', { waitUntil: 'domcontentloaded' });
  const title = await api.title();
  if (!title.includes('Swagger UI')) throw new Error(`Expected Swagger UI, got: ${title}`);
  await api.close();

  // Logout
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL(/\/auth\/(login|signup)/, { timeout: 30_000 });
}

describe('Authentication & Login E2E Tests', () => {
  beforeEach(async () => {
    // Ensure we are on login screen
    const emailInput = await $('~email-input');
    if (!(await emailInput.isDisplayed())) {
      const getStarted = await $('~get-started-button');
      if (await getStarted.isDisplayed()) {
        await getStarted.click();
      }
    }
  });

  it('TC_AUTH_001: Should show validation error when submitting empty credentials', async () => {
    const submitBtn = await $('~login-submit-button');
    await submitBtn.click();
    const errorMsg = await $('~login-error-text');
    expect(await errorMsg.getText()).toContain('Please enter email and password');
  });

  it('TC_AUTH_002: Should show error for invalid email format', async () => {
    const emailInput = await $('~email-input');
    await emailInput.setValue('invalid-email-format');
    const submitBtn = await $('~login-submit-button');
    await submitBtn.click();
    const errorMsg = await $('~login-error-text');
    expect(await errorMsg.getText()).toContain('Invalid email format');
  });

  it('TC_AUTH_003: Should reject invalid password credentials', async () => {
    const emailInput = await $('~email-input');
    await emailInput.setValue('user@example.com');
    const passInput = await $('~password-input');
    await passInput.setValue('wrongpassword123');
    const submitBtn = await $('~login-submit-button');
    await submitBtn.click();
    const errorMsg = await $('~login-error-text');
    expect(await errorMsg.isDisplayed()).toBe(true);
  });

  it('TC_AUTH_004: Should log in successfully with valid user credentials', async () => {
    const emailInput = await $('~email-input');
    await emailInput.setValue('passenger@busapp.com');
    const passInput = await $('~password-input');
    await passInput.setValue('Password123!');
    const submitBtn = await $('~login-submit-button');
    await submitBtn.click();

    const homeHeader = await $('~home-screen-header');
    await homeHeader.waitForDisplayed({ timeout: 10000 });
    expect(await homeHeader.isDisplayed()).toBe(true);
  });
});

describe('Profile & Settings Screen E2E Tests', () => {
  it('TC_PROF_001: Should navigate to Profile Screen', async () => {
    const profileTab = await $('~nav-tab-profile');
    await profileTab.click();

    const profileHeader = await $('~profile-user-name');
    await profileHeader.waitForDisplayed({ timeout: 5000 });
    expect(await profileHeader.isDisplayed()).toBe(true);
  });

  it('TC_PROF_002: Should display user details accurately', async () => {
    const emailField = await $('~profile-user-email');
    expect(await emailField.getText()).toBe('passenger@busapp.com');
  });

  it('TC_PROF_003: Should update user profile phone number', async () => {
    const editBtn = await $('~edit-profile-button');
    await editBtn.click();

    const phoneInput = await $('~profile-phone-input');
    await phoneInput.setValue('+15550192834');

    const saveBtn = await $('~save-profile-button');
    await saveBtn.click();

    const successToast = await $('~toast-message');
    await successToast.waitForDisplayed({ timeout: 5000 });
    expect(await successToast.getText()).toContain('Profile updated successfully');
  });

  it('TC_PROF_004: Should perform logout and return to Welcome Screen', async () => {
    const logoutBtn = await $('~logout-button');
    await logoutBtn.click();

    const getStarted = await $('~get-started-button');
    await getStarted.waitForDisplayed({ timeout: 10000 });
    expect(await getStarted.isDisplayed()).toBe(true);
  });
});

(() => {
  const url = 'https://glsk-auction.vercel.app/install.html';
  const status = document.getElementById('status');
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) {
    status.textContent = 'You are using GLSK as a home-screen app. Tap Open GLSK to enter the league.';
    document.getElementById('install').hidden = true;
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Owner link copied. Paste it into your league message or text.';
    } catch {
      status.textContent = 'Copy the owner link shown below, then paste it into your message.';
    }
  }
  document.getElementById('copy').addEventListener('click', copyLink);
  document.getElementById('share').addEventListener('click', async () => {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: 'GLSK League Office', text: 'Open GLSK and add it to your iPhone home screen. Use your existing league account.', url });
    } catch (error) {
      if (error.name !== 'AbortError') await copyLink();
    }
  });
})();

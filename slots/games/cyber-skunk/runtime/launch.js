const retry = document.getElementById('load-retry');
retry.onclick = () => location.reload();
import('./app.js?v=blackout-entry-1').then(({ boot }) => boot()).catch(error => {
  console.error('Cyber Skunk could not start', error);
  // Keep Retry accessible even when a late asset fails after the guide appears.
  document.getElementById('intro').hidden = true;
  document.getElementById('app').inert = true;
  document.getElementById('loading-screen').hidden = false;
  document.getElementById('load-title').textContent = 'COULD NOT LOAD THE HALL';
  document.getElementById('load-progress').hidden = true;
  retry.hidden = false;
  retry.focus();
});

let activeDialog = null;

const ensureStyles = () => {
  if (document.getElementById('dairy-dialog-styles')) return;
  const style = document.createElement('style');
  style.id = 'dairy-dialog-styles';
  style.textContent = `
    .dairy-dialog-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(20,35,30,.52)}
    .dairy-dialog{width:min(100%,440px);padding:22px;border-radius:16px;background:#fff;box-shadow:0 18px 60px rgba(0,0,0,.24);font-family:system-ui,sans-serif;color:#2c3e50}
    .dairy-dialog-brand{margin:0 0 6px;color:#23834c;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
    .dairy-dialog h2{margin:0 0 10px;font-size:19px}
    .dairy-dialog-message{margin:0;color:#52616b;font-size:14px;line-height:1.55;white-space:pre-line}
    .dairy-dialog input{width:100%;box-sizing:border-box;margin-top:16px;padding:11px;border:1px solid #ccd1d1;border-radius:8px;font:inherit}
    .dairy-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
    .dairy-dialog-actions button{min-height:42px;padding:9px 16px;border:0;border-radius:8px;font:600 14px system-ui;cursor:pointer}
    .dairy-dialog-cancel{background:#eef2f3;color:#34495e}.dairy-dialog-confirm{background:#248b50;color:#fff}.dairy-dialog-danger{background:#c0392b;color:#fff}
    @media(max-width:480px){.dairy-dialog-actions{flex-direction:column-reverse}.dairy-dialog-actions button{width:100%}}
  `;
  document.head.appendChild(style);
};

export const showAppDialog = ({ title = 'Dairy Farm', message = '', type = 'alert', confirmText, cancelText = 'Cancel', placeholder = '', defaultValue = '' }) => new Promise((resolve) => {
  if (activeDialog) activeDialog(false);
  ensureStyles();
  const backdrop = document.createElement('div');
  backdrop.className = 'dairy-dialog-backdrop';
  const dialog = document.createElement('section');
  dialog.className = 'dairy-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  const brand = document.createElement('p');
  brand.className = 'dairy-dialog-brand';
  brand.textContent = localStorage.getItem('dairy_farm_name') || 'Dairy Farm';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const body = document.createElement('p');
  body.className = 'dairy-dialog-message';
  body.textContent = message;
  dialog.append(brand, heading, body);
  let input;
  if (type === 'prompt') {
    input = document.createElement('input');
    input.value = defaultValue;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', title);
    dialog.appendChild(input);
  }
  const actions = document.createElement('div');
  actions.className = 'dairy-dialog-actions';
  const finish = (value) => {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    document.removeEventListener('keydown', onKeyDown);
    if (activeDialog === cancel) activeDialog = null;
    resolve(value);
  };
  const cancel = () => finish(type === 'prompt' ? null : false);
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && type !== 'alert') cancel();
    if (event.key === 'Enter' && type !== 'alert') finish(type === 'prompt' ? input.value : true);
  };
  activeDialog = cancel;
  document.addEventListener('keydown', onKeyDown);
  if (type !== 'alert') {
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'dairy-dialog-cancel';
    cancelButton.textContent = cancelText;
    cancelButton.addEventListener('click', cancel);
    actions.appendChild(cancelButton);
  }
  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = type === 'danger' ? 'dairy-dialog-danger' : 'dairy-dialog-confirm';
  confirmButton.textContent = confirmText || (type === 'alert' ? 'Okay' : type === 'prompt' ? 'Continue' : 'Confirm');
  confirmButton.addEventListener('click', () => finish(type === 'prompt' ? input.value : true));
  actions.appendChild(confirmButton);
  dialog.appendChild(actions);
  backdrop.appendChild(dialog);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop && type !== 'alert') cancel(); });
  document.body.appendChild(backdrop);
  (input || confirmButton).focus();
});

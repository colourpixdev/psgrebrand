const requestForm = document.querySelector('#sales-request-form');
const formNote = document.querySelector('#form-note');

const privateInbox = `${['francois2', 'botha'].join('')}@${['gmail', 'com'].join('.')}`;

requestForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(requestForm);
  const requestType = String(formData.get('requestType') || 'Project request');
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const organisation = String(formData.get('organisation') || '').trim();
  const project = String(formData.get('project') || '').trim();
  const brief = String(formData.get('brief') || '').trim();

  const subject = `PSG Rebrand ${requestType}: ${organisation || 'New enquiry'}`;
  const body = [
    `Request type: ${requestType}`,
    `Name: ${name}`,
    `Work email: ${email}`,
    `Organisation: ${organisation}`,
    `Project or workspace: ${project || 'Not provided'}`,
    '',
    'Brief:',
    brief,
    '',
    'Source: PSG Rebrand public website',
  ].join('\n');

  window.location.href = `mailto:${encodeURIComponent(privateInbox)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (formNote) {
    formNote.textContent = 'Your email app should open with the private request prepared.';
  }
});

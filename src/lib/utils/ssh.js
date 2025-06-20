const executeWithPassword = async () => {
  // @ts-ignore
  const result = await window.electron.invoke('execute-ssh-command-with-password', {
    host: 'localhost',
    username: 'root',
    password: 'root',
    command: 'echo "Hello from Electron!"'
  });
  console.log('SSH Command Result:', result);
  let panel = document.getElementById('ssh-response');
  panel.textContent = result;
}

const executeWithKey = async () => {
  // @ts-ignore
  const result = await window.electron.invoke('connect-ssh');
  console.log('SSH Connection Result:', result);
  let panel = document.getElementById('ssh-response');
  panel.textContent = result;
}

export { executeWithPassword, executeWithKey };
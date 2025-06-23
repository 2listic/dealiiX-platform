import { concatState } from '../states/concatState.svelte';
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
  // const command = document.getElementById("concatenated-text").textContent
  console.log('command', concatState.command)
  // @ts-ignore
  const result = await window.electron.invoke('connect-ssh', {
    command: concatState.command
  });
  console.log('SSH Connection Result:', result);
  let panel = document.getElementById('ssh-response');
  panel.textContent = result;
}

const uploadFileWithKey = async () => {
  // @ts-ignore
  const result = await window.electron.invoke('upload-file-with-key');
  console.log('SSH Connection Result:', result);
  let panel = document.getElementById('ssh-response');
  panel.textContent = result;
}

export { executeWithPassword, executeWithKey, uploadFileWithKey };
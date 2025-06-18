const executeSSHCommandWithPassword = async () => {
  // @ts-ignore
  const result = await window.electron.invoke('execute-ssh-command-with-password', {
    host: 'localhost',
    username: 'root',
    password: 'root',
    command: 'echo "Hello from Electron!"'
  });
  console.log('SSH Command Result:', result);
}

const connectToSSH = async () => {
  // @ts-ignore
  const result = await window.electron.invoke('connect-ssh');
  console.log('SSH Connection Result:', result);
}

export { executeSSHCommandWithPassword, connectToSSH };
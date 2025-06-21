import { Client } from 'ssh2'
import fs from 'fs'
import os from 'os'
import path from 'path'

const __userHomeDir = path.resolve(os.homedir())
const privateKeyPath = path.join(__userHomeDir, '.ssh/id_rsa');

function connectToSSHWithPassword(host, username, password, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) reject(err)
        let data = ''
        stream.on('close', (code, signal) => {
          conn.end()
          resolve(data)
        }).on('data', (chunk) => {
          data += chunk
        }).stderr.on('data', (chunk) => {
          data += chunk
        })
      })
    }).on('error', (err) => {
      reject(err)
    }).connect({
      host,
      port: 5050,
      username,
      password
    })
  })
}

function connectToSSHWithKey(command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
    console.log('SSH Connection established');

    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let data = '';
      stream.on('close', (code, signal) => {
      console.log('Command completed with code', code);
      conn.end();
      resolve(data);
      }).on('data', (chunk) => {
        console.log('STDOUT:', chunk.toString());
        data += chunk;
      }).stderr.on('data', (chunk) => {
        console.log('STDERR:', chunk.toString());
        data += chunk;
      });
    });
    }).on('error', (err) => {
      console.error('SSH Connection error:', err);
      reject(err);
    }).connect({
      host: 'localhost',
      port: 2222,
      username: 'root',
      privateKey: fs.readFileSync(privateKeyPath),
      debug: console.log,
      hostVerifier: (keyHash) => {  // consider hashing the private key
        return true;
      },
      readyTimeout: 5000,           // additional options
      keepaliveInterval: 10000
    });
  });
}

export { connectToSSHWithPassword, connectToSSHWithKey } // export the functions to be used in the main.js inde
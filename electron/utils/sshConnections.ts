import { Client } from 'ssh2'
import fs from 'fs'

export interface SshConnection {
  host: string
  port: number
  username: string
  pathToSsh: string
}

/**
 * @param host
 * @param username
 * @param password
 * @param command
 * @returns stdout + stderr combined
 */
export function connectToSSHWithPassword(
  host: string,
  username: string,
  password: string,
  command: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => {
        console.log('SSH Connection with password established')

        conn.exec(command, (err, stream) => {
          if (err) reject(err)
          let data = ''
          stream
            .on('close', (code: number) => {
              console.log('Command completed with code', code)
              conn.end()
              resolve(data)
            })
            .on('data', (chunk: Buffer) => {
              console.log('STDOUT:', chunk.toString())
              data += chunk
            })
            .stderr.on('data', (chunk: Buffer) => {
              console.log('STDERR:', chunk.toString())
              data += chunk
            })
        })
      })
      .on('error', (err) => {
        console.error('SSH Connection error')
        reject(err)
      })
      .connect({
        host,
        port: 5050,
        username,
        password,
      })
  })
}

/**
 * @param command - Shell command to execute on the remote host.
 * @param connection - SSH connection parameters.
 * @returns stdout + stderr combined.
 */
export function connectToSSHWithKey(
  command: string,
  connection: SshConnection
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn
      .on('ready', () => {
        console.log('SSH Connection with key established')

        conn.exec(command, (err, stream) => {
          if (err) return reject(err)

          let data = ''
          stream
            .on('close', (code: number) => {
              console.log('Command completed with code', code)
              conn.end()
              resolve(data)
            })
            .on('data', (chunk: Buffer) => {
              console.log('STDOUT:', chunk.toString())
              data += chunk
            })
            .stderr.on('data', (chunk: Buffer) => {
              console.log('STDERR:', chunk.toString())
              data += chunk
            })
        })
      })
      .on('error', (err) => {
        console.error('SSH Connection error')
        reject(err)
      })
      .connect({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        privateKey: fs.readFileSync(connection.pathToSsh),
        debug: console.log,
        readyTimeout: 5000,
        keepaliveInterval: 10000,
      })
  })
}

/**
 * @param content - File content to upload.
 * @param remotePath - Destination path on the remote host.
 * @param connection - SSH connection parameters.
 * @returns Confirmation message.
 */
export function uploadFileViaSftp(
  content: string,
  remotePath: string,
  connection: SshConnection
): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('uploadFileViaSftp called')
    const conn = new Client()
    conn
      .on('ready', () => {
        console.log('SSH Connection with key established')
        conn.sftp((err, sftp) => {
          if (err) return reject(err)
          sftp.writeFile(remotePath, content, (err) => {
            if (err) {
              conn.end()
              return reject(err)
            }
            console.log('File uploaded successfully')
            conn.end()
            resolve(`File uploaded to: ${remotePath}`)
          })
        })
      })
      .on('error', (err) => {
        console.error('SFTP Connection error')
        reject(err)
      })
      .connect({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        privateKey: fs.readFileSync(connection.pathToSsh),
        debug: console.log,
      })
  })
}

// Minimal type declarations for the ssh2 package (which ships no bundled types).
declare module 'ssh2' {
  import type { EventEmitter } from 'events'
  import type { Readable } from 'stream'

  interface ConnectConfig {
    host?: string
    port?: number
    username?: string
    password?: string
    privateKey?: Buffer | string
    readyTimeout?: number
    keepaliveInterval?: number
    debug?: (msg: string) => void
    hostVerifier?: (keyHash: string) => boolean
  }

  interface ClientChannel extends Readable {
    stderr: Readable
  }

  interface SFTPWrapper {
    writeFile(
      path: string,
      data: string | Buffer,
      callback: (err: NodeJS.ErrnoException | null) => void
    ): void
  }

  class Client extends EventEmitter {
    connect(config: ConnectConfig): this
    exec(
      command: string,
      callback: (err: Error | undefined, stream: ClientChannel) => void
    ): boolean
    sftp(callback: (err: Error | undefined, sftp: SFTPWrapper) => void): boolean
    end(): this
    on(event: 'ready', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  export { Client }
  export type { ConnectConfig, ClientChannel, SFTPWrapper }
}

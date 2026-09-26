declare module 'JSCPP' {
  interface JSCPPConfig {
    stdio?: {
      write?: (s: string) => void
    }
    unsigned_overflow?: 'error' | 'warn' | 'ignore'
  }

  interface JSCPPStatic {
    run(
      code: string,
      input?: string,
      config?: JSCPPConfig
    ): number
  }

  const JSCPP: JSCPPStatic
  export default JSCPP
}

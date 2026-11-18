export const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
export type SerialOptions = {
  path: string;
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
};

type SerialRecord = { timestamp: number; direction: 'RX' | 'TX'; bytes: Uint8Array };
export type SerialEvent = { id: number } & (
  | { type: 'opened' }
  | { type: 'closed'; error?: string }
  | { type: 'records'; records: SerialRecord[] }
);

type SerialBridge = {
  list(): Promise<string[]>;
  open(id: number, options: SerialOptions): Promise<void>;
  close(id: number): Promise<void>;
  send(id: number, bytes: Uint8Array): Promise<void>;
  onEvent(listener: (event: SerialEvent) => void): () => void;
};

declare global {
  interface Window { exlinkSerial?: SerialBridge }
}

export function serialError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
}

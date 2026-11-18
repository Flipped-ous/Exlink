const { Buffer } = require('node:buffer');

const COM_PORT = /^COM[1-9]\d*$/i;
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_BATCH_BYTES = 1024 * 1024;
const MAX_BATCH_RECORDS = 4096;
const BATCH_INTERVAL_MS = 32;

function completed(run) {
  return new Promise((resolve, reject) => run(error => error ? reject(error) : resolve()));
}

function installSerialIpc(ipcMain, getContents, Port) {
  let active;
  let disposing = false;
  const handlers = [];
  function handle(method, action) {
    const channel = `serial:${method}`;
    handlers.push(channel);
    ipcMain.handle(channel, (event, ...args) => {
      const contents = getContents();
      if (event.sender !== contents || event.senderFrame !== contents.mainFrame) {
        throw new Error('串口请求来源无效。');
      }
      return action(...args);
    });
  }

  function emit(connection, event) {
    const contents = getContents();
    if (!disposing && contents && contents === connection.owner && !contents.isDestroyed()) {
      contents.send('serial:event', { id: connection.id, ...event });
    }
  }

  function flush(connection) {
    clearTimeout(connection.timer);
    connection.timer = undefined;
    const records = connection.records;
    connection.records = [];
    connection.bytes = 0;
    if (records.length && connection.opened) emit(connection, { type: 'records', records });
  }

  function stop(connection, error) {
    if (connection.stopping) return connection.stopping;
    flush(connection);
    connection.stopping = Promise.resolve().then(async () => {
      await connection.opening?.catch(() => {});
      if (connection.port.isOpen) {
        try {
          await completed(done => connection.port.close(done));
        } catch (cause) {
          error ||= `关闭 ${connection.path} 失败。${cause.message}`;
        }
      }
      if (active === connection) active = undefined;
      if (connection.opened) emit(connection, { type: 'closed', error });
    });
    return connection.stopping;
  }

  function record(connection, direction, bytes) {
    if (active !== connection || connection.stopping) return;
    const timestamp = Date.now();
    for (let start = 0; start < bytes.length; start += MAX_RECORD_BYTES) {
      const chunk = bytes.subarray(start, start + MAX_RECORD_BYTES);
      if (connection.bytes + chunk.length > MAX_BATCH_BYTES || connection.records.length >= MAX_BATCH_RECORDS) {
        if (connection.opened) flush(connection);
        else {
          connection.overflow = true;
          return;
        }
      }
      connection.records.push({ timestamp, direction, bytes: Uint8Array.from(chunk) });
      connection.bytes += chunk.length;
    }
    if (connection.opened && !connection.timer) {
      connection.timer = setTimeout(() => flush(connection), BATCH_INTERVAL_MS);
    }
  }

  handle('list', async () => {
    if (!Port) throw new Error('串口驱动组件加载失败，请重新安装项目依赖。');
    const ports = await Port.list();
    return ports.filter(port => COM_PORT.test(port.path)).map(port => port.path.toUpperCase())
      .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
  });

  handle('open', async (id, options) => {
    if (!Port) throw new Error('串口驱动组件加载失败，请重新安装项目依赖。');
    if (disposing) throw new Error('应用正在退出。');
    if (active) throw new Error('当前串口尚未关闭。');
    const { path, baudRate, dataBits, stopBits, parity } = options ?? {};
    if (!Number.isSafeInteger(id) || id < 1 || typeof path !== 'string' || !COM_PORT.test(path) ||
      !BAUD_RATES.includes(baudRate) || ![7, 8].includes(dataBits) ||
      ![1, 2].includes(stopBits) || !['none', 'even', 'odd'].includes(parity)) {
      throw new Error('串口参数无效。');
    }
    const port = new Port({ path, baudRate, dataBits, stopBits, parity, autoOpen: false, lock: true });
    const connection = active = { id, path, port, owner: getContents(), records: [], bytes: 0 };
    port.on('data', bytes => record(connection, 'RX', bytes));
    port.on('error', error => {
      if (connection.opened) void stop(connection, `${path} 通信失败。${error.message}`);
      else connection.openError = error;
    });
    port.on('close', error => {
      if (connection.opened) void stop(connection, `${path} 已断开。${error?.message ?? ''}`);
      else connection.openError ||= error ?? new Error('端口已断开。');
    });
    try {
      connection.opening = completed(done => port.open(done));
      await connection.opening;
      if (connection.openError) throw connection.openError;
      if (connection.overflow) throw new Error('连接期间接收缓存已满。');
      if (active !== connection || connection.stopping) return;
      connection.opened = true;
      emit(connection, { type: 'opened' });
      flush(connection);
    } catch (error) {
      await stop(connection);
      throw new Error(`无法打开 ${path}。请检查端口是否被占用或已拔出。${error.message}`);
    }
  });

  handle('close', async id => {
    if (active?.id === id) await stop(active);
  });

  handle('send', async (id, bytes) => {
    const connection = active;
    if (!connection?.opened || connection.id !== id || connection.stopping) throw new Error('请先连接串口。');
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_RECORD_BYTES) {
      throw new Error('发送内容必须为 1 至 65,536 字节。');
    }
    if (connection.sending) throw new Error('上一条指令正在发送。');
    connection.sending = true;
    try {
      await completed(done => connection.port.write(Buffer.from(bytes), done));
      await completed(done => connection.port.drain(done));
      if (connection.stopping) throw new Error('端口已断开。');
      record(connection, 'TX', bytes);
    } catch (error) {
      const message = `发送失败。${error.message}`;
      await stop(connection, message);
      throw new Error(message);
    } finally {
      connection.sending = false;
    }
  });

  const disconnect = () => active ? stop(active) : Promise.resolve();
  return {
    disconnect,
    async dispose() {
      disposing = true;
      await disconnect();
      handlers.forEach(channel => ipcMain.removeHandler(channel));
    },
  };
}

module.exports = { installSerialIpc };

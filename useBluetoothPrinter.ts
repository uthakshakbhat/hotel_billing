import { useCallback, useRef, useState } from 'react';
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';

const BT_KNOWN_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

interface WritableChannel {
  deviceId: string;
  service: string;
  characteristic: string;
  writeWithoutResponse: boolean;
}

export function useBluetoothPrinter() {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const channelRef = useRef<WritableChannel | null>(null);
  const initialized = useRef(false);

  const connect = useCallback(async () => {
    try {
      if (!initialized.current) {
        await BleClient.initialize();
        initialized.current = true;
      }

      const device = await BleClient.requestDevice({
        optionalServices: BT_KNOWN_SERVICES,
      });

      await BleClient.connect(device.deviceId, () => {
        channelRef.current = null;
        setConnected(false);
        setDeviceName(null);
      });

      const services = await BleClient.getServices(device.deviceId);

      let found: WritableChannel | null = null;
      for (const service of services) {
        for (const char of service.characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            found = {
              deviceId: device.deviceId,
              service: service.uuid,
              characteristic: char.uuid,
              writeWithoutResponse: !!char.properties.writeWithoutResponse,
            };
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        alert('Connected, but no writable channel found on this printer.');
        await BleClient.disconnect(device.deviceId);
        return;
      }

      channelRef.current = found;
      setConnected(true);
      setDeviceName(device.name || 'printer');
    } catch (e: any) {
      console.error(e);
      if (e?.message && !e.message.includes('cancelled')) {
        alert('Bluetooth connection failed: ' + e.message);
      }
    }
  }, []);

  const sendBytes = useCallback(async (bytes: Uint8Array) => {
    const channel = channelRef.current;
    if (!channel) throw new Error('Printer not connected');
    const CHUNK = 180;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = Array.from(bytes.slice(i, i + CHUNK));
      const dataView = numbersToDataView(slice);
      if (channel.writeWithoutResponse) {
        await BleClient.writeWithoutResponse(channel.deviceId, channel.service, channel.characteristic, dataView);
      } else {
        await BleClient.write(channel.deviceId, channel.service, channel.characteristic, dataView);
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  }, []);

  return { connected, deviceName, connect, sendBytes };
}
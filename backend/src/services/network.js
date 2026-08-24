import os from 'os';

export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  
  // First priority: Look for Wi-Fi or Ethernet IPv4 address (192.168.x.x or 10.x.x.x)
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
          return net.address;
        }
      }
    }
  }

  // Second priority: Any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}

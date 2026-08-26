import os from 'os';

export function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  
  // List of virtual / internal adapter name patterns to ignore
  const isVirtual = (name) => /vethernet|virtual|vmnet|vbox|docker|tailscale|wsl|tap|tun|loopback/i.test(name);

  // First priority: Real Wi-Fi or Ethernet IPv4 address (192.168.x.x or 10.x.x.x) on non-virtual interfaces
  for (const name of Object.keys(interfaces)) {
    if (isVirtual(name)) continue;
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address)) {
          return net.address;
        }
      }
    }
  }

  // Second priority: Any non-internal, non-virtual IPv4
  for (const name of Object.keys(interfaces)) {
    if (isVirtual(name)) continue;
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  // Fallback: Check any interface if no non-virtual ones found
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }

  return 'localhost';
}

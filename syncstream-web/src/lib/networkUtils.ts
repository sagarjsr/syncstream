// Network Info Utility
// Dynamically detects and displays current network information

export const getNetworkInfo = () => {
  if (typeof window === 'undefined') {
    return {
      protocol: 'http:',
      hostname: 'localhost',
      port: '3000',
      origin: 'http://localhost:3000'
    };
  }

  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    port: window.location.port || (window.location.protocol === 'https:' ? '443' : '80'),
    origin: window.location.origin
  };
};

export const getServerUrl = (serverPort = '3001') => {
  const networkInfo = getNetworkInfo();
  return `${networkInfo.protocol}//${networkInfo.hostname}:${serverPort}`;
};

export const formatNetworkDisplay = () => {
  const info = getNetworkInfo();
  
  // For localhost/127.0.0.1, show network-friendly message
  if (info.hostname === 'localhost' || info.hostname === '127.0.0.1') {
    return {
      displayUrl: `${info.origin} (localhost)`,
      networkUrl: 'Enable network access by running server with 0.0.0.0',
      isLocal: true
    };
  }

  // For network IPs, show as-is
  return {
    displayUrl: info.origin,
    networkUrl: info.origin,
    isLocal: false
  };
};

export const copyToClipboard = async (text: string) => {
  if (typeof window === 'undefined') return false;
  
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers or non-HTTPS
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

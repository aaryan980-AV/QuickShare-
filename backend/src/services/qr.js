import QRCode from 'qrcode';

/**
 * Generate high quality QR code data URL
 * @param {string} text - URL or text to encode
 * @returns {Promise<string>} Base64 Data URL of the QR code PNG
 */
export async function generateQRCode(text) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    return dataUrl;
  } catch (error) {
    console.error('[QR Service] Error generating QR code:', error);
    throw new Error('Failed to generate QR code.');
  }
}

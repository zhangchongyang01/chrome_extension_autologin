/**
 * 加密工具模块
 * 使用 Web Crypto API 进行 AES-GCM 加密
 */

class CryptoUtil {
  constructor() {
    this.keyPromise = null;
  }

  /**
   * 生成或获取加密密钥
   * 基于设备特征生成密钥，确保安全性
   */
  async getKey() {
    if (this.keyPromise) {
      return this.keyPromise;
    }

    this.keyPromise = (async () => {
      // 尝试从存储中获取密钥
      const result = await chrome.storage.local.get(['cryptoKey']);
      
      if (result.cryptoKey) {
        // 导入已存在的密钥（直接导入 AES-GCM 密钥）
        const keyData = this.base64ToArrayBuffer(result.cryptoKey);
        return await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      }

      // 生成新密钥
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.getDeviceFingerprint()),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode('autologin-salt'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      // 导出并保存密钥
      const exportedKey = await crypto.subtle.exportKey('raw', derivedKey);
      const keyBase64 = this.arrayBufferToBase64(exportedKey);
      await chrome.storage.local.set({ cryptoKey: keyBase64 });

      return derivedKey;
    })();

    return this.keyPromise;
  }

  /**
   * 获取设备指纹（用于生成密钥）
   */
  getDeviceFingerprint() {
    // 使用 navigator 和 screen 信息生成设备指纹
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString()
    ].join('|');
    
    return fingerprint;
  }

  /**
   * 加密数据
   */
  async encrypt(text) {
    if (!text) return '';
    
    const key = await this.getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedText
    );

    // 将 IV 和加密数据组合
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return this.arrayBufferToBase64(combined.buffer);
  }

  /**
   * 解密数据
   */
  async decrypt(encryptedData) {
    if (!encryptedData) return '';
    
    try {
      const key = await this.getKey();
      const combined = this.base64ToArrayBuffer(encryptedData);
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        data
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('解密失败:', error);
      return '';
    }
  }

  /**
   * ArrayBuffer 转 Base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64 转 ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// 创建全局实例
const cryptoUtil = new CryptoUtil();


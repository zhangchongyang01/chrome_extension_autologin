/**
 * 后台脚本 - 处理存储和消息传递
 */

// 初始化存储
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['sites'], (result) => {
    if (!result.sites) {
      chrome.storage.local.set({ sites: [] });
    }
  });
});

// 处理消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDecryptedCredentials') {
    handleGetDecryptedCredentials(request.siteId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  } else if (request.action === 'getSites') {
    handleGetSites()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'saveSite') {
    handleSaveSite(request.site)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'deleteSite') {
    handleDeleteSite(request.siteId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'updateSite') {
    handleUpdateSite(request.site)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * 获取解密后的凭证
 */
async function handleGetDecryptedCredentials(siteId) {
  try {
    const result = await chrome.storage.local.get(['sites']);
    const sites = result.sites || [];
    const site = sites.find(s => s.id === siteId);

    if (!site) {
      return { success: false, error: '网站配置不存在' };
    }

    // 导入加密工具（在 background 中需要重新实现或使用消息传递）
    // 为了简化，我们在这里直接使用 crypto API
    const username = await decryptValue(site.username);
    const password = await decryptValue(site.password);

    return {
      success: true,
      username,
      password
    };
  } catch (error) {
    console.error('获取凭证失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取所有网站配置
 */
async function handleGetSites() {
  try {
    const result = await chrome.storage.local.get(['sites']);
    return {
      success: true,
      sites: result.sites || []
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 保存网站配置
 */
async function handleSaveSite(site) {
  try {
    const result = await chrome.storage.local.get(['sites']);
    const sites = result.sites || [];

    // 加密用户名和密码
    const encryptedUsername = await encryptValue(site.username);
    const encryptedPassword = await encryptValue(site.password);

    const newSite = {
      id: site.id || generateId(),
      name: site.name,
      urlPattern: site.urlPattern,
      username: encryptedUsername,
      password: encryptedPassword,
      autoFill: site.autoFill !== undefined ? site.autoFill : true,
      autoLogin: site.autoLogin !== undefined ? site.autoLogin : false
    };

    sites.push(newSite);
    await chrome.storage.local.set({ sites });

    return { success: true, site: newSite };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 更新网站配置
 */
async function handleUpdateSite(site) {
  try {
    const result = await chrome.storage.local.get(['sites']);
    const sites = result.sites || [];
    const index = sites.findIndex(s => s.id === site.id);

    if (index === -1) {
      return { success: false, error: '网站配置不存在' };
    }

    // 加密用户名和密码（如果提供了新值）
    let encryptedUsername = sites[index].username;
    let encryptedPassword = sites[index].password;

    if (site.username !== undefined) {
      encryptedUsername = await encryptValue(site.username);
    }
    if (site.password !== undefined) {
      encryptedPassword = await encryptValue(site.password);
    }

    sites[index] = {
      ...sites[index],
      name: site.name || sites[index].name,
      urlPattern: site.urlPattern || sites[index].urlPattern,
      username: encryptedUsername,
      password: encryptedPassword,
      autoFill: site.autoFill !== undefined ? site.autoFill : sites[index].autoFill,
      autoLogin: site.autoLogin !== undefined ? site.autoLogin : sites[index].autoLogin
    };

    await chrome.storage.local.set({ sites });

    return { success: true, site: sites[index] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 删除网站配置
 */
async function handleDeleteSite(siteId) {
  try {
    const result = await chrome.storage.local.get(['sites']);
    const sites = result.sites || [];
    const filtered = sites.filter(s => s.id !== siteId);

    await chrome.storage.local.set({ sites: filtered });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 加密工具类（在 background 中使用）
 */
class BackgroundCrypto {
  constructor() {
    this.keyPromise = null;
  }

  async getKey() {
    if (this.keyPromise) {
      return this.keyPromise;
    }

    this.keyPromise = (async () => {
      const result = await chrome.storage.local.get(['cryptoKey']);
      
      if (result.cryptoKey) {
        // 导入已存在的密钥（直接导入 AES 密钥）
        const keyData = this.base64ToArrayBuffer(result.cryptoKey);
        return await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      }

      // 生成新密钥（使用固定的种子，确保与 content script 兼容）
      // 注意：实际使用时，content script 会先生成密钥并存储
      // background 只需要读取已存储的密钥即可
      // 如果密钥不存在，生成一个临时密钥（通常不会执行到这里）
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const exportedKey = await crypto.subtle.exportKey('raw', key);
      const keyBase64 = this.arrayBufferToBase64(exportedKey);
      await chrome.storage.local.set({ cryptoKey: keyBase64 });

      return key;
    })();

    return this.keyPromise;
  }

  async encrypt(text) {
    if (!text) return '';
    
    try {
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

      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return this.arrayBufferToBase64(combined.buffer);
    } catch (error) {
      console.error('加密失败:', error);
      return '';
    }
  }

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

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

const bgCrypto = new BackgroundCrypto();

/**
 * 加密值
 */
async function encryptValue(text) {
  return await bgCrypto.encrypt(text);
}

/**
 * 解密值
 */
async function decryptValue(encrypted) {
  return await bgCrypto.decrypt(encrypted);
}

/**
 * 生成唯一 ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}


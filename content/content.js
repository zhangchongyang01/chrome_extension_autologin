/**
 * 内容脚本 - 负责自动填充登录信息
 */

class AutoLoginContent {
  constructor() {
    this.isFilled = false;
    this.currentSite = null;
    this.elements = null;
    this.init();
  }

  async init() {
    // 监听 URL 变化（SPA 应用）
    this.observeUrlChanges();
    
    // 初始检测
    await this.checkAndFill();
    
    // 监听输入框点击事件，支持手动点击触发填充
    this.setupInputClickListeners();
    
    // 监听消息（手动触发）
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'manualFill') {
        this.manualFill();
        sendResponse({ success: true });
      } else if (request.action === 'checkPage') {
        this.checkPage().then(result => {
          sendResponse({ success: true, result });
        });
        return true; // 异步响应
      }
    });
  }

  /**
   * 观察 URL 变化（用于 SPA）
   */
  observeUrlChanges() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.isFilled = false;
        setTimeout(() => this.checkAndFill(), 500);
      }
    }).observe(document, { subtree: true, childList: true });

    // 使用 popstate 事件监听浏览器前进后退
    window.addEventListener('popstate', () => {
      this.isFilled = false;
      setTimeout(() => this.checkAndFill(), 500);
    });
  }

  /**
   * 设置输入框点击监听器
   * 当用户点击用户名或密码输入框时，自动填充
   */
  setupInputClickListeners() {
    // 使用事件委托，监听整个文档的点击事件
    document.addEventListener('click', async (e) => {
      const target = e.target;
      
      // 检查是否点击的是输入框
      if (target.tagName === 'INPUT' && 
          (target.type === 'text' || target.type === 'email' || target.type === 'password')) {
        
        // 延迟执行，确保页面已加载完成
        setTimeout(async () => {
          // 检查当前是否有匹配的网站配置
          const currentUrl = window.location.href;
          const detection = await siteDetector.detectSite(currentUrl);
          
          if (detection && detection.site && detection.elements) {
            // 检查点击的输入框是否是用户名或密码输入框
            const isUsernameInput = target === detection.elements.usernameInput;
            const isPasswordInput = target === detection.elements.passwordInput;
            
            if ((isUsernameInput || isPasswordInput) && !this.isFilled) {
              // 如果点击的是登录表单的输入框，且还未填充，则触发填充
              this.currentSite = detection.site;
              this.elements = detection.elements;
              await this.fillForm();
            } else if (isUsernameInput && this.isFilled) {
              // 如果已填充但用户点击了用户名框，重新填充用户名
              const response = await chrome.runtime.sendMessage({
                action: 'getDecryptedCredentials',
                siteId: this.currentSite.id
              });
              if (response && response.success && response.username) {
                this.fillInput(target, response.username);
              }
            } else if (isPasswordInput && this.isFilled) {
              // 如果已填充但用户点击了密码框，重新填充密码
              const response = await chrome.runtime.sendMessage({
                action: 'getDecryptedCredentials',
                siteId: this.currentSite.id
              });
              if (response && response.success && response.password) {
                this.fillInput(target, response.password);
              }
            }
          }
        }, 100);
      }
    }, true); // 使用捕获阶段，确保能捕获到事件
    
    // 也监听 focus 事件，作为补充
    document.addEventListener('focus', async (e) => {
      const target = e.target;
      
      if (target.tagName === 'INPUT' && 
          (target.type === 'text' || target.type === 'email' || target.type === 'password')) {
        
        setTimeout(async () => {
          const currentUrl = window.location.href;
          const detection = await siteDetector.detectSite(currentUrl);
          
          if (detection && detection.site && detection.elements) {
            const isUsernameInput = target === detection.elements.usernameInput;
            const isPasswordInput = target === detection.elements.passwordInput;
            
            if ((isUsernameInput || isPasswordInput) && !this.isFilled) {
              this.currentSite = detection.site;
              this.elements = detection.elements;
              await this.fillForm();
            }
          }
        }, 100);
      }
    }, true);
  }

  /**
   * 检查页面并自动填充
   */
  async checkAndFill() {
    if (this.isFilled) return;

    const currentUrl = window.location.href;
    const detection = await siteDetector.detectSite(currentUrl);

    if (detection && detection.site) {
      this.currentSite = detection.site;
      this.elements = detection.elements;

      // 如果启用了自动填充
      if (this.currentSite.autoFill) {
        await this.fillForm();
        
        // 如果启用了自动登录
        if (this.currentSite.autoLogin && this.elements.loginButton) {
          setTimeout(() => this.clickLogin(), 500);
        }
      }
    }
  }

  /**
   * 手动填充（用户触发）
   */
  async manualFill() {
    this.isFilled = false;
    const currentUrl = window.location.href;
    const detection = await siteDetector.detectSite(currentUrl);

    if (detection && detection.site) {
      this.currentSite = detection.site;
      this.elements = detection.elements;
      await this.fillForm();
    } else {
      // 如果没有匹配的配置，尝试使用第一个配置
      const result = await chrome.storage.local.get(['sites']);
      const sites = result.sites || [];
      if (sites.length > 0) {
        this.currentSite = sites[0];
        this.elements = siteDetector.detectLoginElements();
        if (this.elements.hasLoginForm) {
          await this.fillForm();
        }
      }
    }
  }

  /**
   * 填充表单
   */
  async fillForm() {
    if (!this.elements || !this.currentSite) return;

    try {
      // 从后台获取解密后的用户名和密码
      const response = await chrome.runtime.sendMessage({
        action: 'getDecryptedCredentials',
        siteId: this.currentSite.id
      });

      if (!response || !response.success) {
        console.error('获取凭证失败');
        return;
      }

      const { username, password } = response;

      // 填充用户名
      if (this.elements.usernameInput && username) {
        this.fillInput(this.elements.usernameInput, username);
      }

      // 填充密码
      if (this.elements.passwordInput && password) {
        this.fillInput(this.elements.passwordInput, password);
      }

      this.isFilled = true;
    } catch (error) {
      console.error('填充表单失败:', error);
    }
  }

  /**
   * 填充输入框（触发相应事件）
   */
  fillInput(input, value) {
    if (!input) return;

    // 设置值
    input.value = value;

    // 触发事件
    const events = ['input', 'change', 'keyup', 'keydown'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      input.dispatchEvent(event);
    });

    // 对于 React 等框架，需要设置内部属性
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
      const event = new Event('input', { bubbles: true });
      input.dispatchEvent(event);
    }
  }

  /**
   * 点击登录按钮
   */
  clickLogin() {
    if (!this.elements || !this.elements.loginButton) return;

    try {
      const button = this.elements.loginButton;
      
      // 对于 Angular 等框架，需要触发多个事件以确保变更检测正常工作
      // 触发 mousedown 事件
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(mouseDownEvent);
      
      // 触发 mouseup 事件
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(mouseUpEvent);
      
      // 触发 click 事件
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(clickEvent);
      
      // 最后调用原生的 click 方法作为备用
      button.click();
    } catch (error) {
      console.error('点击登录按钮失败:', error);
    }
  }

  /**
   * 检查当前页面（用于 popup）
   */
  async checkPage() {
    const currentUrl = window.location.href;
    const detection = await siteDetector.detectSite(currentUrl);
    const elements = siteDetector.detectLoginElements();

    return {
      url: currentUrl,
      hasLoginForm: elements.hasLoginForm,
      matchedSite: detection?.site || null,
      elements: {
        hasUsername: !!elements.usernameInput,
        hasPassword: !!elements.passwordInput,
        hasLoginButton: !!elements.loginButton
      }
    };
  }
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AutoLoginContent();
  });
} else {
  new AutoLoginContent();
}


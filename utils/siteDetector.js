/**
 * 登录页面检测工具
 * 支持 URL 匹配和元素检测
 */

class SiteDetector {
  /**
   * 检查 URL 是否匹配模式
   * 支持通配符 * 和 ? 匹配
   */
  matchUrlPattern(url, pattern) {
    if (!pattern) return false;
    
    // 转换为正则表达式
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
      .replace(/\*/g, '.*') // * 匹配任意字符
      .replace(/\?/g, '.'); // ? 匹配单个字符
    
    const regex = new RegExp('^' + regexPattern + '$', 'i');
    return regex.test(url);
  }

  /**
   * 检测页面是否存在登录表单元素
   */
  detectLoginElements() {
    const selectors = [
      // 常见的用户名输入框选择器
      'input[type="text"][name*="user" i]',
      'input[type="text"][name*="name" i]',
      'input[type="text"][name*="email" i]',
      'input[type="text"][name*="account" i]',
      'input[type="text"][name*="login" i]',
      'input[type="email"]',
      'input[id*="user" i]',
      'input[id*="name" i]',
      'input[id*="email" i]',
      'input[id*="account" i]',
      'input[id*="login" i]',
      // 常见的密码输入框选择器
      'input[type="password"]'
    ];

    const usernameSelectors = selectors.slice(0, -1); // 除了密码选择器
    const passwordSelector = 'input[type="password"]';

    // 查找用户名输入框
    let usernameInput = null;
    for (const selector of usernameSelectors) {
      usernameInput = document.querySelector(selector);
      if (usernameInput) break;
    }

    // 查找密码输入框
    const passwordInput = document.querySelector(passwordSelector);

    // 查找登录按钮
    const loginButtonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:contains("登录")',
      'button:contains("登陆")',
      'button:contains("Login")',
      'button:contains("Sign in")',
      'a:contains("登录")',
      '[class*="login" i]',
      '[id*="login" i]',
      '[class*="submit" i]'
    ];

    let loginButton = null;
    for (const selector of loginButtonSelectors) {
      try {
        loginButton = document.querySelector(selector);
        if (loginButton) {
          // 检查按钮文本是否包含登录相关关键词
          const text = (loginButton.textContent || loginButton.value || '').toLowerCase();
          if (text.includes('登录') || text.includes('登陆') || 
              text.includes('login') || text.includes('sign in') ||
              selector.includes('submit')) {
            break;
          }
        }
      } catch (e) {
        // 忽略无效选择器
      }
    }

    // 如果没找到，尝试更通用的方法
    if (!loginButton) {
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        if (form.querySelector('input[type="password"]')) {
          loginButton = form.querySelector('button[type="submit"], input[type="submit"]');
          if (loginButton) break;
        }
      }
    }

    return {
      usernameInput,
      passwordInput,
      loginButton,
      hasLoginForm: !!(usernameInput && passwordInput)
    };
  }

  /**
   * 检测当前页面是否匹配某个网站配置
   */
  async detectSite(currentUrl) {
    try {
      // 从存储中获取所有网站配置
      const result = await chrome.storage.local.get(['sites']);
      const sites = result.sites || [];

      // 先进行 URL 匹配
      const urlMatchedSites = sites.filter(site => 
        this.matchUrlPattern(currentUrl, site.urlPattern)
      );

      // 如果 URL 匹配，检查页面元素
      if (urlMatchedSites.length > 0) {
        const elements = this.detectLoginElements();
        
        // 如果检测到登录表单，返回第一个匹配的配置
        if (elements.hasLoginForm) {
          return {
            site: urlMatchedSites[0],
            elements: elements
          };
        }
      }

      // 如果 URL 不匹配，但检测到登录表单，也返回（用于手动添加）
      const elements = this.detectLoginElements();
      if (elements.hasLoginForm && sites.length > 0) {
        // 尝试模糊匹配 URL
        for (const site of sites) {
          const siteDomain = new URL(site.urlPattern.split('*')[0]).hostname;
          const currentDomain = new URL(currentUrl).hostname;
          if (siteDomain === currentDomain) {
            return {
              site: site,
              elements: elements
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('检测网站失败:', error);
      return null;
    }
  }

  /**
   * 获取当前页面 URL
   */
  getCurrentUrl() {
    return window.location.href;
  }
}

// 创建全局实例
const siteDetector = new SiteDetector();


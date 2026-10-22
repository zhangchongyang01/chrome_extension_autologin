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
   * 通过文本内容查找按钮
   * @param {string[]} keywords - 要匹配的关键词数组
   * @param {NodeList|Array} elements - 要搜索的元素集合，如果不提供则搜索所有按钮
   * @returns {HTMLElement|null} 找到的按钮元素，如果没找到返回 null
   */
  findButtonByText(keywords, elements = null) {
    // 如果没有提供元素集合，搜索所有按钮、提交输入和链接
    if (!elements) {
      elements = document.querySelectorAll('button, input[type="submit"], a[class*="btn"], a[class*="button"]');
    }

    for (const element of elements) {
      // 获取元素的文本内容（包括子元素）
      // 去掉所有空白字符，兼容 "登 录"、"Sign In" 等带空格的写法
      const text = (element.textContent || element.value || element.innerText || '').replace(/\s+/g, '').toLowerCase();

      // 检查是否包含任何关键词
      for (const keyword of keywords) {
        if (text.includes(keyword.replace(/\s+/g, '').toLowerCase())) {
          return element;
        }
      }
    }

    return null;
  }

  /**
   * 检测页面是否存在登录表单元素
   */
  detectLoginElements() {
    const selectors = [
      // 常见的用户名输入框选择器
      'input[autocomplete="username" i]',
      'input[type="text"][name*="user" i]',
      'input[type="text"][name*="name" i]',
      'input[type="text"][name*="email" i]',
      'input[type="text"][name*="account" i]',
      'input[type="text"][name*="login" i]',
      'input[type="text"][placeholder*="用户名"]',
      'input[type="text"][placeholder*="账号"]',
      'input[type="text"][placeholder*="邮箱"]',
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
    let passwordInput = document.querySelector(passwordSelector);

    // 部分登录页（如令牌/动态口令登录）没有 password 类型输入框，
    // 按特征关键字查找口令/验证码类输入框作为密码框
    if (!passwordInput) {
      const keywordRegex = /captcha|口令|密码|password|token|otp|动态/i;
      const candidates = document.querySelectorAll('input[type="text"], input:not([type]), input[type="tel"]');
      for (const input of candidates) {
        if (input === usernameInput) continue;
        const attrs = `${input.id} ${input.name} ${input.placeholder}`;
        if (keywordRegex.test(attrs)) {
          passwordInput = input;
          break;
        }
      }
    }

    // 兜底：取同一表单内用户名输入框之后的第一个可见文本输入框
    if (!passwordInput && usernameInput) {
      const form = usernameInput.closest('form');
      if (form) {
        const textInputs = Array.from(
          form.querySelectorAll('input[type="text"], input:not([type])')
        ).filter(i => i !== usernameInput && (i.offsetWidth || i.offsetHeight));
        if (textInputs.length > 0) {
          passwordInput = textInputs[0];
        }
      }
    }

    // 查找登录按钮
    const loginKeywords = ['登录', '登陆', 'Login', 'Sign in'];
    let loginButton = null;

    // 1. 优先在包含用户名/密码输入框的表单内查找，避免误选表单外的提交按钮
    const anchorInput = passwordInput || usernameInput;
    const loginForm = anchorInput ? anchorInput.closest('form') : null;
    if (loginForm) {
      loginButton = loginForm.querySelector(
        'button.ant-btn-primary, button[nztype="primary"], button[class*="btn-primary" i]'
      );
      if (!loginButton) {
        loginButton = this.findButtonByText(
          loginKeywords,
          loginForm.querySelectorAll('button, input[type="submit"], a')
        );
      }
      if (!loginButton) {
        loginButton = loginForm.querySelector('button[type="submit"], input[type="submit"]');
      }
    }

    // 2. 全局按文本内容查找
    if (!loginButton) {
      loginButton = this.findButtonByText(loginKeywords);
    }

    // 3. 全局按常见类名/ID 查找
    if (!loginButton) {
      const classSelectors = [
        'button.ant-btn-primary',
        'button[nztype="primary"]',
        'button[class*="btn-primary" i]',
        'button[class*="login" i]',
        'button[id*="login" i]',
        'a[class*="login" i]',
        'a[id*="login" i]'
      ];
      for (const selector of classSelectors) {
        try {
          loginButton = document.querySelector(selector);
          if (loginButton) break;
        } catch (e) {
          // 忽略无效选择器
        }
      }
    }

    // 4. 兜底：页面上的任意提交按钮
    if (!loginButton) {
      loginButton = document.querySelector('button[type="submit"], input[type="submit"]');
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


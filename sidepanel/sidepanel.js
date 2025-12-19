/**
 * Side Panel 管理界面逻辑
 */

class SidePanelManager {
  constructor() {
    this.sites = [];
    this.editingSiteId = null;
    this.init();
  }

  async init() {
    await this.loadSites();
    this.setupEventListeners();
    this.checkCurrentPage();
    // 确保手动填充区域始终可见
    this.ensureManualFillVisible();
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    // 添加网站按钮
    document.getElementById('addSiteBtn').addEventListener('click', () => {
      this.openModal();
    });

    // 关闭模态框
    document.getElementById('closeModalBtn').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.closeModal();
    });

    // 表单提交
    document.getElementById('siteForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSite();
    });

    // 手动填充按钮
    document.getElementById('testFillBtn').addEventListener('click', () => {
      this.manualFill();
    });

    // 点击模态框外部关闭
    document.getElementById('siteModal').addEventListener('click', (e) => {
      if (e.target.id === 'siteModal') {
        this.closeModal();
      }
    });
  }

  /**
   * 加载网站列表
   */
  async loadSites() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSites' });
      if (response && response.success) {
        this.sites = response.sites || [];
        this.renderSites();
      } else {
        // 静默处理错误，不打印日志
        this.sites = [];
        this.renderSites();
      }
    } catch (error) {
      // 静默处理错误，不打印日志
      this.sites = [];
      this.renderSites();
    }
  }

  /**
   * 强制刷新网站列表
   */
  async refreshSitesList() {
    // 清空当前列表
    this.sites = [];
    // 重新加载
    await this.loadSites();
    // 再次确保渲染
    this.renderSites();
    // 使用双重保险，确保列表更新
    setTimeout(() => {
      this.loadSites().then(() => {
        this.renderSites();
      });
    }, 100);
  }

  /**
   * 渲染网站列表
   */
  renderSites() {
    const sitesList = document.getElementById('sitesList');
    const emptyState = document.getElementById('emptyState');

    if (this.sites.length === 0) {
      emptyState.style.display = 'block';
      sitesList.innerHTML = '';
      sitesList.appendChild(emptyState);
      return;
    }

    emptyState.style.display = 'none';
    sitesList.innerHTML = '';

    this.sites.forEach(site => {
      const siteItem = this.createSiteItem(site);
      sitesList.appendChild(siteItem);
    });
  }

  /**
   * 创建网站项
   */
  createSiteItem(site) {
    const item = document.createElement('div');
    item.className = 'site-item';
    item.innerHTML = `
      <div class="site-info">
        <h3>${this.escapeHtml(site.name)}</h3>
        <p class="site-url">${this.escapeHtml(site.urlPattern)}</p>
        <div class="site-options">
          <span class="badge ${site.autoFill ? 'badge-success' : 'badge-disabled'}">
            ${site.autoFill ? '自动填充' : '手动填充'}
          </span>
          ${site.autoLogin ? '<span class="badge badge-info">自动登录</span>' : ''}
        </div>
      </div>
      <div class="site-actions">
        <button class="btn-icon" data-action="edit" data-id="${site.id}" title="编辑">
          ✏️
        </button>
        <button class="btn-icon" data-action="delete" data-id="${site.id}" title="删除">
          🗑️
        </button>
      </div>
    `;

    // 绑定事件
    item.querySelector('[data-action="edit"]').addEventListener('click', () => {
      this.editSite(site.id);
    });

    item.querySelector('[data-action="delete"]').addEventListener('click', () => {
      this.deleteSite(site.id);
    });

    return item;
  }

  /**
   * 打开模态框
   */
  openModal(site = null) {
    const modal = document.getElementById('siteModal');
    const form = document.getElementById('siteForm');
    const modalTitle = document.getElementById('modalTitle');

    if (!modal || !form || !modalTitle) {
      // 元素不存在，静默处理
      alert('无法打开表单，请刷新页面后重试');
      return;
    }

    if (site) {
      // 编辑模式
      this.editingSiteId = site.id;
      modalTitle.textContent = '编辑网站';
      document.getElementById('siteName').value = site.name;
      document.getElementById('urlPattern').value = site.urlPattern;
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      document.getElementById('autoFill').checked = site.autoFill;
      document.getElementById('autoLogin').checked = site.autoLogin;
    } else {
      // 添加模式
      this.editingSiteId = null;
      modalTitle.textContent = '添加网站';
      form.reset();
      document.getElementById('autoFill').checked = true;
      document.getElementById('autoLogin').checked = false;
    }

    if (modal) {
      modal.style.display = 'flex';
    }
  }

  /**
   * 关闭模态框
   */
  closeModal() {
    const modal = document.getElementById('siteModal');
    const form = document.getElementById('siteForm');
    
    if (modal) {
      modal.style.display = 'none';
    }
    
    if (form) {
      form.reset();
    }
    
    this.editingSiteId = null;
  }

  /**
   * 保存网站
   */
  async saveSite() {
    const name = document.getElementById('siteName').value.trim();
    const urlPattern = document.getElementById('urlPattern').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const autoFill = document.getElementById('autoFill').checked;
    const autoLogin = document.getElementById('autoLogin').checked;

    if (!name || !urlPattern || !username || !password) {
      alert('请填写所有必填项');
      return;
    }

    try {
      const siteData = {
        name,
        urlPattern,
        username,
        password,
        autoFill,
        autoLogin
      };

      if (this.editingSiteId) {
        siteData.id = this.editingSiteId;
        const response = await chrome.runtime.sendMessage({
          action: 'updateSite',
          site: siteData
        });
        if (response && response.success) {
          // 先关闭模态框
          this.closeModal();
          // 强制刷新列表
          await this.refreshSitesList();
        } else {
          const errorMsg = response?.error || '未知错误';
          alert('更新失败: ' + errorMsg);
        }
      } else {
        const response = await chrome.runtime.sendMessage({
          action: 'saveSite',
          site: siteData
        });
        if (response && response.success) {
          // 先关闭模态框
          this.closeModal();
          // 强制刷新列表
          await this.refreshSitesList();
        } else {
          const errorMsg = response?.error || '未知错误';
          alert('保存失败: ' + errorMsg);
        }
      }
    } catch (error) {
      alert('保存失败: ' + (error.message || '未知错误'));
    }
  }

  /**
   * 编辑网站
   */
  async editSite(siteId) {
    const site = this.sites.find(s => s.id === siteId);
    if (site) {
      // 获取解密后的用户名（密码需要重新输入）
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getDecryptedCredentials',
          siteId: siteId
        });
        if (response && response.success) {
          site.username = response.username;
        }
      } catch (error) {
        // 静默处理错误
      }
      this.openModal(site);
    }
  }

  /**
   * 删除网站
   */
  async deleteSite(siteId) {
    if (!confirm('确定要删除这个网站配置吗？')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteSite',
        siteId: siteId
      });
      if (response && response.success) {
        await this.loadSites();
      } else {
        alert('删除失败: ' + (response?.error || '未知错误'));
      }
    } catch (error) {
      // 静默处理错误
      alert('删除失败: ' + error.message);
    }
  }

  /**
   * 检查当前页面
   */
  async checkCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      // 向 content script 发送消息检查页面
      chrome.tabs.sendMessage(tab.id, { action: 'checkPage' }, (response) => {
        if (chrome.runtime.lastError) {
          // content script 可能未加载，但仍然显示手动填充按钮
          this.showManualFillWithError('页面未加载或需要刷新');
          return;
        }

        if (response && response.result) {
          const info = document.getElementById('currentPageInfo');
          const currentUrl = document.getElementById('currentUrl');
          const detectionStatus = document.getElementById('detectionStatus');

          // 检查元素是否存在
          if (!info || !currentUrl || !detectionStatus) {
            // 元素不存在，静默处理
            return;
          }

          currentUrl.textContent = response.result.url;
          
          if (response.result.hasLoginForm) {
            if (response.result.matchedSite) {
              detectionStatus.textContent = `✓ 已匹配: ${response.result.matchedSite.name}`;
              detectionStatus.className = 'value status-success';
            } else {
              detectionStatus.textContent = '✓ 检测到登录表单（未匹配）';
              detectionStatus.className = 'value status-warning';
            }
          } else {
            detectionStatus.textContent = '✗ 未检测到登录表单';
            detectionStatus.className = 'value status-error';
          }

          info.style.display = 'block';
        } else {
          this.showManualFillWithError('无法检测页面状态');
        }
      });
    } catch (error) {
      // 静默处理错误
      this.showManualFillWithError('检查页面时出错');
    }
  }

  /**
   * 显示手动填充区域（带错误信息）
   */
  showManualFillWithError(message) {
    const info = document.getElementById('currentPageInfo');
    const currentUrl = document.getElementById('currentUrl');
    const detectionStatus = document.getElementById('detectionStatus');

    // 检查元素是否存在
    if (!info || !currentUrl || !detectionStatus) {
      // 元素不存在，静默处理
      return;
    }

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && currentUrl) {
          currentUrl.textContent = tabs[0].url || '未知页面';
        } else if (currentUrl) {
          currentUrl.textContent = '无法获取页面URL';
        }
      });
    } catch (e) {
      if (currentUrl) {
        currentUrl.textContent = '未知页面';
      }
    }

    if (detectionStatus) {
      detectionStatus.textContent = message || '⚠ 无法检测页面';
      detectionStatus.className = 'value status-warning';
    }
    
    if (info) {
      info.style.display = 'block';
    }
  }

  /**
   * 确保手动填充区域可见
   */
  ensureManualFillVisible() {
    // 如果检查页面失败，至少显示手动填充按钮
    // 使用 requestAnimationFrame 确保 DOM 已准备好
    requestAnimationFrame(() => {
      setTimeout(() => {
        // 检查模态框是否打开，如果打开则不执行
        const modal = document.getElementById('siteModal');
        if (modal && modal.style.display === 'flex') {
          return; // 模态框打开时，不执行此操作
        }
        
        const info = document.getElementById('currentPageInfo');
        if (info) {
          // 检查元素是否真的隐藏（包括内联样式和计算样式）
          const computedStyle = window.getComputedStyle(info);
          if (computedStyle.display === 'none' || info.style.display === 'none') {
            this.showManualFillWithError('点击手动填充按钮进行填充');
          }
        } else {
          // 如果元素不存在，静默处理，不显示警告
          // 元素不存在，静默处理
        }
      }, 500);
    });
  }

  /**
   * 手动填充
   */
  async manualFill() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      chrome.tabs.sendMessage(tab.id, { action: 'manualFill' }, (response) => {
        if (chrome.runtime.lastError) {
          alert('无法连接到页面，请刷新页面后重试');
          return;
        }
        if (response && response.success) {
          alert('填充成功！');
          // 侧边栏不需要关闭窗口
        }
      });
    } catch (error) {
      // 静默处理错误
      alert('填充失败: ' + error.message);
    }
  }

  /**
   * HTML 转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new SidePanelManager();
});


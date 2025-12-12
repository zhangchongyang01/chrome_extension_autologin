/**
 * Popup 管理界面逻辑
 */

class PopupManager {
  constructor() {
    this.sites = [];
    this.editingSiteId = null;
    this.init();
  }

  async init() {
    await this.loadSites();
    this.setupEventListeners();
    this.checkCurrentPage();
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
        this.sites = response.sites;
        this.renderSites();
      }
    } catch (error) {
      console.error('加载网站列表失败:', error);
    }
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

    if (site) {
      // 编辑模式
      this.editingSiteId = site.id;
      modalTitle.textContent = '编辑网站';
      document.getElementById('siteName').value = site.name;
      document.getElementById('urlPattern').value = site.urlPattern;
      // 注意：不能显示已加密的密码，需要从后台获取解密后的值
      // 这里简化处理，编辑时密码需要重新输入
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

    modal.style.display = 'flex';
  }

  /**
   * 关闭模态框
   */
  closeModal() {
    document.getElementById('siteModal').style.display = 'none';
    document.getElementById('siteForm').reset();
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
          await this.loadSites();
          this.closeModal();
        } else {
          alert('更新失败: ' + (response?.error || '未知错误'));
        }
      } else {
        const response = await chrome.runtime.sendMessage({
          action: 'saveSite',
          site: siteData
        });
        if (response && response.success) {
          await this.loadSites();
          this.closeModal();
        } else {
          alert('保存失败: ' + (response?.error || '未知错误'));
        }
      }
    } catch (error) {
      console.error('保存网站失败:', error);
      alert('保存失败: ' + error.message);
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
        console.error('获取用户名失败:', error);
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
      console.error('删除网站失败:', error);
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
          // content script 可能未加载
          return;
        }

        if (response && response.result) {
          const info = document.getElementById('currentPageInfo');
          const currentUrl = document.getElementById('currentUrl');
          const detectionStatus = document.getElementById('detectionStatus');

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
        }
      });
    } catch (error) {
      console.error('检查当前页面失败:', error);
    }
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
          window.close();
        }
      });
    } catch (error) {
      console.error('手动填充失败:', error);
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
  new PopupManager();
});


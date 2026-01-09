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
    this.setupStorageListener();
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

    // 密码显示/隐藏切换按钮
    document.getElementById('passwordToggleBtn').addEventListener('click', () => {
      this.togglePasswordVisibility();
    });

    // 导出配置按钮
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportSites();
    });

    // 导入配置按钮
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });

    // 文件选择事件
    document.getElementById('importFileInput').addEventListener('change', (e) => {
      this.handleFileSelect(e);
    });
  }

  /**
   * 设置存储监听器
   */
  setupStorageListener() {
    // 监听 storage 变化，自动刷新列表
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.sites) {
        // 当 sites 数据发生变化时，重新加载列表
        this.loadSites();
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
        console.log('网站列表已刷新，共', this.sites.length, '个网站');
      } else {
        console.error('加载网站列表失败:', response?.error || '未知错误');
        // 即使失败也尝试渲染空列表
        this.sites = [];
        this.renderSites();
      }
    } catch (error) {
      console.error('加载网站列表异常:', error);
      // 发生异常时也尝试渲染空列表
      this.sites = [];
      this.renderSites();
    }
  }

  /**
   * 渲染网站列表
   * @param {boolean} scrollToBottom - 是否滚动到底部
   */
  renderSites(scrollToBottom = false) {
    const sitesList = document.getElementById('sitesList');
    const emptyState = document.getElementById('emptyState');

    if (!sitesList) {
      console.error('sitesList 元素不存在');
      return;
    }

    if (this.sites.length === 0) {
      if (emptyState) {
        emptyState.style.display = 'block';
      }
      sitesList.innerHTML = '';
      if (emptyState) {
        sitesList.appendChild(emptyState);
      }
      return;
    }

    if (emptyState) {
      emptyState.style.display = 'none';
    }
    sitesList.innerHTML = '';

    this.sites.forEach(site => {
      const siteItem = this.createSiteItem(site);
      sitesList.appendChild(siteItem);
    });

    // 如果需要滚动到底部，在渲染完成后滚动
    if (scrollToBottom) {
      // 使用 setTimeout 确保 DOM 更新完成后再滚动
      setTimeout(() => {
        sitesList.scrollTop = sitesList.scrollHeight;
      }, 0);
    }
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
      // 回显解密后的账号和密码
      document.getElementById('username').value = site.username || '';
      const passwordInput = document.getElementById('password');
      passwordInput.value = site.password || '';
      // 编辑模式下默认显示密码（明文）
      passwordInput.type = 'text';
      document.querySelector('.password-toggle-icon').textContent = '🙈';  // 眼睛闭合图标，表示当前是显示状态
      document.getElementById('autoFill').checked = site.autoFill;
      document.getElementById('autoLogin').checked = site.autoLogin;
    } else {
      // 添加模式
      this.editingSiteId = null;
      modalTitle.textContent = '添加网站';
      form.reset();
      // 添加模式下密码输入框默认明文显示，与编辑模式一致
      const passwordInput = document.getElementById('password');
      passwordInput.type = 'text';
      document.querySelector('.password-toggle-icon').textContent = '🙈';  // 眼睛闭合图标，表示当前是显示状态
      document.getElementById('autoFill').checked = true;
      document.getElementById('autoLogin').checked = true;
    }

    if (modal) {
      modal.style.display = 'flex';
    }
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
   * 切换密码显示/隐藏
   */
  togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('.password-toggle-icon');
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleIcon.textContent = '🙈';  // 眼睛闭合图标，表示当前是显示状态
    } else {
      passwordInput.type = 'password';
      toggleIcon.textContent = '👁️';  // 眼睛睁开图标，表示当前是隐藏状态
    }
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
          // 直接更新本地列表中的网站
          const index = this.sites.findIndex(s => s.id === this.editingSiteId);
          if (index !== -1 && response.site) {
            this.sites[index] = response.site;
            this.renderSites();
          } else {
            // 如果找不到，重新加载列表
            await this.loadSites();
          }
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
          // 直接添加新网站到本地列表
          if (response.site) {
            this.sites.push(response.site);
            // 添加成功后，滚动到底部显示最新添加的元素
            this.renderSites(true);
          } else {
            // 如果响应中没有网站数据，重新加载列表
            await this.loadSites();
            // 加载完成后也滚动到底部
            const sitesList = document.getElementById('sitesList');
            if (sitesList) {
              setTimeout(() => {
                sitesList.scrollTop = sitesList.scrollHeight;
              }, 100);
            }
          }
          this.closeModal();
        } else {
          alert('保存失败: ' + (response?.error || '未知错误'));
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
      // 获取解密后的用户名和密码
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getDecryptedCredentials',
          siteId: siteId
        });
        if (response && response.success) {
          site.username = response.username;
          site.password = response.password;
        }
      } catch (error) {
        console.error('获取凭证失败:', error);
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

  /**
   * 导出网站配置
   */
  async exportSites() {
    try {
      // 使用 downloads API，在 background script 中处理下载，避免 popup 关闭导致的问题
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('导出超时，请重试'));
        }, 10000);
        
        chrome.runtime.sendMessage({ action: 'exportSites' }, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          resolve(response);
        });
      });
      
      if (!response) {
        alert('导出失败: 未收到响应');
        return;
      }
      
      if (response.success) {
        alert(`成功导出 ${response.count} 个网站配置\n文件已保存为: ${response.filename}`);
      } else {
        const errorMsg = response?.error || '未知错误';
        console.error('导出失败:', errorMsg);
        alert('导出失败: ' + errorMsg);
      }
    } catch (error) {
      console.error('导出配置失败:', error);
      alert('导出失败: ' + error.message);
    }
  }

  /**
   * 处理文件选择
   */
  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    // 重置文件输入
    event.target.value = '';

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // 验证数据格式
      if (!importData.sites || !Array.isArray(importData.sites)) {
        alert('导入失败: 文件格式错误，缺少 sites 数组');
        return;
      }

      if (importData.sites.length === 0) {
        alert('导入失败: 文件中没有网站配置');
        return;
      }

      // 确认导入
      const confirmMsg = `确定要导入 ${importData.sites.length} 个网站配置吗？\n导入的配置将添加到现有配置中。`;
      if (!confirm(confirmMsg)) {
        return;
      }

      // 调用导入接口
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'importSites',
          sites: importData.sites
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      });

      if (!response) {
        alert('导入失败: 未收到响应');
        return;
      }

      if (response.success) {
        let message = '';
        if (response.message) {
          // 如果所有配置都已存在
          message = response.message;
        } else {
          // 有新的配置导入
          message = `成功导入 ${response.importedCount} 个网站配置`;
          if (response.skippedCount > 0) {
            message += `\n已跳过 ${response.skippedCount} 个重复配置`;
          }
          message += `\n当前共有 ${response.totalCount} 个网站配置`;
        }
        alert(message);
        // 刷新列表
        await this.loadSites();
      } else {
        const errorMsg = response?.error || '未知错误';
        console.error('导入失败:', errorMsg);
        alert('导入失败: ' + errorMsg);
      }
    } catch (error) {
      console.error('导入配置失败:', error);
      if (error instanceof SyntaxError) {
        alert('导入失败: JSON 格式错误');
      } else {
        alert('导入失败: ' + error.message);
      }
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new SidePanelManager();
});


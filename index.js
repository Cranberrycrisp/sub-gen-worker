/**
 * Universal Subscription Generator for Clash & Shadowrocket
 * Author: flyrr
 * Version: 3.0 - Fixed const assignment error & Unified Shadowrocket to use subscribe method
 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 路由：/config 用于生成 Clash YAML，/ 用于显示主界面
        if (url.pathname === '/config') {
            return handleClashConfigRequest(request);
        } else {
            return handleUIPageRequest(request);
        }
    },
};

/**
 * API: 生成 Clash 的 YAML 配置文件
 * @param {Request} request
 */
function handleClashConfigRequest(request) {
    const {searchParams} = new URL(request.url);
    // 将 const 改为 let，以允许后续的国旗添加操作
    let name = decodeURIComponent(searchParams.get('name') || 'MyProxy');
    const server = searchParams.get('server');
    const port = searchParams.get('port');
    const username = decodeURIComponent(searchParams.get('username') || '');
    const password = decodeURIComponent(searchParams.get('password') || '');
    const type = searchParams.get('type') || 'socks5';

    if (!server || !port) {
        return new Response('Error: "server" & "port" are required.', {status: 400});
    }

    // 🎌 为确保直接链接也能生成国旗，在后端同样添加国旗处理逻辑
    const FLAG_MAP = {
        // 亚洲
        '香港|港|HK|Hong Kong': '🇭🇰', '台湾|台|TW|Taiwan': '🇹🇼', '日本|日|JP|Japan': '🇯🇵',
        '韩国|韩|KR|Korea|首尔': '🇰🇷', '新加坡|狮城|SG|Singapore': '🇸🇬', '中国|CN|China': '🇨🇳',
        '澳门|Macao': '🇲🇴', '马来西亚|MY|Malaysia': '🇲🇾', '泰国|TH|Thailand': '🇹🇭',
        '印度|IN|India': '🇮🇳', '越南|VN|Vietnam': '🇻🇳', '菲律宾|PH|Philippines': '🇵🇭',
        // 欧洲
        '英国|英|UK|United Kingdom|London': '🇬🇧', '德国|德|DE|Germany': '🇩🇪', '法国|法|FR|France': '🇫🇷',
        '荷兰|NL|Netherlands': '🇳🇱', '俄罗斯|俄|RU|Russia': '🇷🇺', '意大利|IT|Italy': '🇮🇹',
        '西班牙|ES|Spain': '🇪🇸', '瑞士|CH|Switzerland': '🇨🇭', '瑞典|SE|Sweden': '🇸🇪',
        '挪威|NO|Norway': '🇳🇴', '芬兰|FI|Finland': '🇫🇮', '丹麦|DK|Denmark': '🇩🇰',
        '波兰|PL|Poland': '🇵🇱', '乌克兰|UA|Ukraine': '🇺🇦', '土耳其|TR|Turkey': '🇹🇷',
        // 北美洲
        '美国|美|US|USA|United States': '🇺🇸', '加拿大|加|CA|Canada': '🇨🇦', '墨西哥|MX|Mexico': '🇲🇽',
        // 南美洲
        '巴西|BR|Brazil': '🇧🇷', '阿根廷|AR|Argentina': '🇦🇷', '智利|CL|Chile': '🇨🇱',
        // 大洋洲
        '澳大利亚|澳洲|澳|AU|Australia': '🇦🇺', '新西兰|NZ|New Zealand': '🇳🇿',
        // 非洲
        '南非|ZA|South Africa': '🇿🇦', '埃及|EG|Egypt': '🇪🇬',
        // 中东
        '阿联酋|UAE|迪拜|Dubai': '🇦🇪', '沙特|SA|Saudi': '🇸🇦', '以色列|IL|Israel': '🇮🇱',
    };

    const addFlagToNodeName = (nodeName) => {
        if (!nodeName || typeof nodeName !== 'string') return nodeName;
        // 检查是否已经包含国旗 emoji
        const flagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
        if (flagRegex.test(nodeName)) return nodeName; // 已有国旗，直接返回
        // 遍历国旗映射表查找匹配
        for (const [keywords, flag] of Object.entries(FLAG_MAP)) {
            const regex = new RegExp(keywords, 'i'); // 不区分大小写匹配
            if (regex.test(nodeName)) {
                return `${flag} ${nodeName}`;
            }
        }
        return nodeName; // 未匹配到国旗，返回原名称
    };

    // 对从URL参数获取的节点名称进行国旗处理
    name = addFlagToNodeName(name);


    // 增强的YAML字符串转义函数
    const escapeYamlString = (str) => {
        if (!str) return '';
        // 如果包含特殊字符、中文或国旗，用双引号包围并转义
        const needsQuotes = /[:\[\]{}#&*!|>'"%@`\n\r\t]|\uD83C[\uDDE6-\uDDFF]/u.test(str) || /^[\d\-+.]/.test(str) || /^\s|\s$/.test(str) || /[\u4e00-\u9fff]/.test(str);
        if (needsQuotes) {
            return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        }
        return str;
    };

    // 构建代理节点配置
    let proxyNode = `
  - name: ${escapeYamlString(name)}
    type: ${type}
    server: ${server}
    port: ${parseInt(port)}`;

    if (username && username.trim()) {
        proxyNode += `
    username: ${escapeYamlString(username)}`;
    }
    if (password && password.trim()) {
        proxyNode += `
    password: ${escapeYamlString(password)}`;
    }
    if (type === 'socks5') {
        proxyNode += `
    udp: true`;
    }

    const clashConfig = `proxies:${proxyNode}

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - ${escapeYamlString(name)}
      - DIRECT

rules:
  - MATCH,🚀 节点选择
`;

    // 使用处理过的 name 生成文件名
    return new Response(clashConfig, {
        headers: {
            'Content-Type': 'text/yaml; charset=utf-8',
            // Content-Disposition，同时支持ASCII和UTF-8文件名
            'Content-Disposition': `attachment; filename="config.yaml"; filename*=UTF-8''${encodeURIComponent(name + '.yaml')}`
        },
    });
}


/**
 * UI: 显示主界面，处理手动和自动生成逻辑
 * @param {Request} request
 */
function handleUIPageRequest(request) {
    const {origin, searchParams} = new URL(request.url);

    // 从 URL 参数预填充表单 - 正确处理 URL 解码
    const prefill = {
        name: decodeURIComponent(searchParams.get('name') || ''),
        type: searchParams.get('type') || 'socks5',
        server: searchParams.get('server') || '',
        port: searchParams.get('port') || '',
        username: decodeURIComponent(searchParams.get('username') || ''),
        password: decodeURIComponent(searchParams.get('password') || ''),
    };

    let autoTriggerScript = '';
    // 如果 URL 提供了必要参数，则生成自动触发脚本（默认触发Clash）
    if (prefill.server && prefill.port) {
        autoTriggerScript = `
      setTimeout(() => {
        try {
          const params = new URLSearchParams(window.location.search);
          // 此处生成的URL将由后端的handleClashConfigRequest处理
          const configUrl = \`${origin}/config?\${params.toString()}\`;
          const clashLink = \`clash://install-config?url=\${encodeURIComponent(configUrl)}\`;
        
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = \`
              <div class="success">✅ 参数已自动识别，正在自动拉起客户端...</div>
              <p>如果浏览器没有反应，请F5刷新页面或者手动点击下方复制或导入按钮。</p>
          \`;
        
          window.location.href = clashLink;
        } catch (e) {
          console.error('Auto-trigger failed:', e);
          document.getElementById('result').innerHTML = '<div class="error">⚠️ 自动导入失败，请手动选择客户端。</div>';
        }
      }, 500);
    `;
    }

    // HTML 转义函数
    const escapeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    };

    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>通用代理订阅生成器</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; 
            line-height: 1.6; 
            padding: 20px; 
            max-width: 680px; 
            margin: 0 auto; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { 
            background: #fff; 
            padding: 40px; 
            border-radius: 16px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
            backdrop-filter: blur(10px);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 { 
            color: #333; 
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 700;
        }
        .header p {
            color: #666;
            margin: 0;
            font-size: 14px;
        }
        .form-group { 
            margin-bottom: 20px; 
        }
        label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: 600; 
            color: #444;
            font-size: 14px;
        }
        .required::after {
            content: " *";
            color: #e74c3c;
        }
        input, select { 
            width: 100%; 
            padding: 14px 16px; 
            font-size: 16px; 
            border: 2px solid #e1e8ed; 
            border-radius: 8px; 
            transition: all 0.3s ease;
            background: #fff;
        }
        input:focus, select:focus { 
            border-color: #667eea; 
            outline: none; 
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            transform: translateY(-2px);
        }
        input:invalid {
            border-color: #e74c3c;
        }
        .button-group { 
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px; 
            margin-top: 30px; 
        }
        .btn { 
            padding: 16px 24px; 
            font-size: 16px; 
            font-weight: 600; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            transition: all 0.3s ease;
            text-decoration: none;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
        }
        .btn:hover::before {
            left: 100%;
        }
        .btn-clash { 
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white; 
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-clash:hover { 
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
        }
        .btn-rocket { 
            background: linear-gradient(45deg, #56ab2f, #a8e6cf);
            color: white; 
            box-shadow: 0 4px 15px rgba(86, 171, 47, 0.4);
        }
        .btn-rocket:hover { 
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(86, 171, 47, 0.6);
        }
        .btn-copy {
            background: linear-gradient(45deg, #ffa726, #ff9800);
            color: white;
            box-shadow: 0 4px 15px rgba(255, 167, 38, 0.4);
            grid-column: 1 / -1;
            margin-top: 10px;
        }
        .btn-copy:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 167, 38, 0.6);
        }
        .btn:active { 
            transform: translateY(0); 
        }
        #result { 
            margin-top: 25px; 
            padding: 20px; 
            border-radius: 8px; 
            text-align: center;
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .success { 
            background: linear-gradient(45deg, #56ab2f, #a8e6cf);
            color: white; 
            border: none;
            box-shadow: 0 4px 15px rgba(86, 171, 47, 0.3);
        }
        .error { 
            background: linear-gradient(45deg, #e74c3c, #c0392b);
            color: white; 
            border: none;
            box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
        }
        .protocol-info {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            font-size: 13px;
            color: #666;
            margin-top: 10px;
        }
        .link-display {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 15px;
            margin-top: 15px;
            word-break: break-all;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            color: #495057;
            text-align: left;
        }
        .copy-buttons {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-top: 15px;
        }
        .btn-small {
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 600;
        }
        @media (max-width: 480px) {
            body { padding: 10px; }
            .container { padding: 20px; }
            .button-group { 
                grid-template-columns: 1fr;
            }
            .copy-buttons {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 通用代理订阅生成器</h1>
            <p>支持 Clash 和 Shadowrocket 客户端一键导入</p>
        </div>
        
        <div id="result"></div>
        
        <form id="proxy-form">
            <div class="form-group">
                <label for="name">节点名称:</label>
                <input type="text" id="name" placeholder="支持中文节点名称，如：香港节点" value="${escapeHtml(prefill.name || '我的代理节点')}">
            </div>
            
            <div class="form-group">
                <label for="type">代理协议:</label>
                <select id="type">
                    <option value="socks5" ${prefill.type === 'socks5' ? 'selected' : ''}>SOCKS5</option>
                    <!-- 未来可扩展: http, ss, vmess, trojan 等 -->
                </select>
                <div class="protocol-info">💡 当前支持 SOCKS5 协议，后续版本将支持更多协议类型</div>
            </div>

            <div class="form-group">
                <label for="server" class="required">服务器地址:</label>
                <input type="text" id="server" placeholder="IP 地址或域名" value="${escapeHtml(prefill.server)}" required>
            </div>

            <div class="form-group">
                <label for="port" class="required">端口:</label>
                <input type="number" id="port" placeholder="1-65535" min="1" max="65535" value="${escapeHtml(prefill.port)}" required>
            </div>

            <div class="form-group">
                <label for="username">用户名:</label>
                <input type="text" id="username" placeholder="可选，支持中文用户名" value="${escapeHtml(prefill.username)}">
            </div>

            <div class="form-group">
                <label for="password">密码:</label>
                <input type="password" id="password" placeholder="可选" value="${escapeHtml(prefill.password)}">
            </div>

            <div class="button-group">
                <button type="button" class="btn btn-clash" onclick="importTo('clash')">
                    😺 导入到 Clash 🐾
                </button>
                <button type="button" class="btn btn-rocket" onclick="importTo('shadowrocket')">
                    🚀 导入到 Shadowrocket
                </button>
            </div>
        </form>
    </div>

    <script>
        // 国旗映射表 - 根据关键词匹配国旗
        const FLAG_MAP = {
            // 亚洲
            '香港|港|HK|Hong Kong': '🇭🇰',
            '台湾|台|TW|Taiwan': '🇹🇼', 
            '日本|日|JP|Japan': '🇯🇵',
            '韩国|韩|KR|Korea|首尔': '🇰🇷',
            '新加坡|狮城|SG|Singapore': '🇸🇬',
            '中国|CN|China': '🇨🇳',
            '澳门|Macao': '🇲🇴',
            '马来西亚|MY|Malaysia': '🇲🇾',
            '泰国|TH|Thailand': '🇹🇭',
            '印度|IN|India': '🇮🇳',
            '越南|VN|Vietnam': '🇻🇳',
            '菲律宾|PH|Philippines': '🇵🇭',
        
            // 欧洲
            '英国|英|UK|United Kingdom|London': '🇬🇧',
            '德国|德|DE|Germany': '🇩🇪',
            '法国|法|FR|France': '🇫🇷',
            '荷兰|NL|Netherlands': '🇳🇱',
            '俄罗斯|俄|RU|Russia': '🇷🇺',
            '意大利|IT|Italy': '🇮🇹',
            '西班牙|ES|Spain': '🇪🇸',
            '瑞士|CH|Switzerland': '🇨🇭',
            '瑞典|SE|Sweden': '🇸🇪',
            '挪威|NO|Norway': '🇳🇴',
            '芬兰|FI|Finland': '🇫🇮',
            '丹麦|DK|Denmark': '🇩🇰',
            '波兰|PL|Poland': '🇵🇱',
            '乌克兰|UA|Ukraine': '🇺🇦',
            '土耳其|TR|Turkey': '🇹🇷',
        
            // 北美洲
            '美国|美|US|USA|United States': '🇺🇸',
            '加拿大|加|CA|Canada': '🇨🇦',
            '墨西哥|MX|Mexico': '🇲🇽',
        
            // 南美洲
            '巴西|BR|Brazil': '🇧🇷',
            '阿根廷|AR|Argentina': '🇦🇷',
            '智利|CL|Chile': '🇨🇱',
        
            // 大洋洲
            '澳大利亚|澳洲|澳|AU|Australia': '🇦🇺',
            '新西兰|NZ|New Zealand': '🇳🇿',
        
            // 非洲
            '南非|ZA|South Africa': '🇿🇦',
            '埃及|EG|Egypt': '🇪🇬',
        
            // 中东
            '阿联酋|UAE|迪拜|Dubai': '🇦🇪',
            '沙特|SA|Saudi': '🇸🇦',
            '以色列|IL|Israel': '🇮🇱',
        };
        
        /**
         * 根据节点名称自动添加国旗
         * @param {string} nodeName - 节点名称
         * @returns {string} - 带国旗的节点名称
         */
        const addFlagToNodeName = (nodeName) => {
            if (!nodeName || typeof nodeName !== 'string') {
                return nodeName;
            }
        
            // 检查是否已经包含国旗 emoji
            const flagRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
            if (flagRegex.test(nodeName)) {
                return nodeName; // 已有国旗，直接返回
            }
        
            // 遍历国旗映射表查找匹配
            for (const [keywords, flag] of Object.entries(FLAG_MAP)) {
                const regex = new RegExp(keywords, 'i'); // 不区分大小写匹配
                if (regex.test(nodeName)) {
                    return flag + ' ' + nodeName; // 使用字符串连接替代模板字符串
                }
            }
        
            return nodeName; // 未匹配到国旗，返回原名称
        };
        
        const getFormValues = () => ({
            name: document.getElementById('name').value.trim() || '代理节点',
            type: document.getElementById('type').value.trim(),
            server: document.getElementById('server').value.trim(),
            port: document.getElementById('port').value.trim(),
            username: document.getElementById('username').value.trim(),
            password: document.getElementById('password').value.trim()
        });
        
        // 正确编码 URL 参数（处理中文）
        const buildConfigUrl = (origin, values) => {
            const params = new URLSearchParams();
            Object.entries(values).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });
            return \`\${origin}/config?\${params.toString()}\`;
        };
        
        const generateClashLink = (configUrl) => {
            return \`clash://install-config?url=\${encodeURIComponent(configUrl)}\`;
        };

        //  生成 Shadowrocket 订阅链接
        const generateShadowrocketSubLink = (configUrl) => {
            return \`shadowrocket://add/\${encodeURIComponent(configUrl)}\`;
        };

        // 复制到剪贴板
        const copyToClipboard = async (text) => {
            try {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(text);
                    showMessage('✅ 已复制到剪贴板', 'success');
                } else {
                    fallbackCopy(text);
                }
            } catch (err) { console.error('Copy failed:', err); fallbackCopy(text); }
        };

        // 备用复制方法
        const fallbackCopy = (text) => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                showMessage(successful ? '✅ 已复制到剪贴板' : '❌ 复制失败', successful ? 'success' : 'error');
            } catch (err) { console.error('Fallback copy failed:', err); showMessage('❌ 复制失败', 'error'); }
            textArea.remove();
        };

        // 显示消息
        const showMessage = (message, type = 'success') => {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = \`<div class="\${type === 'success' ? 'success' : 'error'}">\${message}</div>\`;
            setTimeout(() => { if (resultDiv.innerHTML.includes(message)) resultDiv.innerHTML = ''; }, 3000);
        };

        // 统一导入逻辑
        const importTo = (client) => {
            const values = getFormValues();
            
            if (!values.server || !values.port) {
                showMessage('⚠️ 服务器地址和端口是必填项！', 'error'); return;
            }
            if (isNaN(parseInt(values.port)) || parseInt(values.port) < 1 || parseInt(values.port) > 65535) {
                showMessage('⚠️ 端口号必须在 1-65535 范围内！', 'error'); return;
            }

            try {
                // 两个客户端都使用同一个配置文件 URL
                const configUrl = buildConfigUrl(location.origin, values);
                let protocolLink, linkText;

                if (client === 'clash') {
                    protocolLink = generateClashLink(configUrl);
                    linkText = '正在生成 Clash 订阅并拉起客户端...';
                } else if (client === 'shadowrocket') {
                    protocolLink = generateShadowrocketSubLink(configUrl);
                    linkText = '正在生成 Shadowrocket 订阅并拉起客户端...';
                } else {
                    showMessage('❌ 不支持的客户端类型', 'error'); return;
                }
                
                // [修改] 统一显示订阅链接
                document.getElementById('result').innerHTML = \`
                    <div class="success">\${linkText}</div>
                    <p style="font-size: 13px; color: #666; margin-top: 10px;">
                        如果没有自动拉起，请复制下方通用订阅链接手动导入：
                    </p>
                    <div class="link-display">\${configUrl}</div>
                    <div class="copy-buttons">
                        <button class="btn btn-copy btn-small" onclick="copyToClipboard('\${configUrl}')">
                            📋 复制通用订阅链接
                        </button>
                    </div>
                \`;
                
                // 尝试拉起客户端
                window.location.href = protocolLink;
                
            } catch (error) {
                console.error('Generate link failed:', error);
                showMessage('❌ 生成链接失败，请检查输入参数', 'error');
            }
        };

        // 表单实时验证
        document.addEventListener('DOMContentLoaded', () => {
            const serverInput = document.getElementById('server');
            const portInput = document.getElementById('port');
            
            const validateInput = (input, validator, errorMsg) => {
                const isValid = validator(input.value);
                if (!isValid && input.value.trim()) {
                    input.style.borderColor = '#e74c3c';
                    input.title = errorMsg;
                } else {
                    input.style.borderColor = '#e1e8ed';
                    input.title = '';
                }
                return isValid;
            };

            serverInput.addEventListener('input', () => {
                validateInput(serverInput, (value) => {
                    // 更宽松的服务器地址验证，支持 IPv6 和复杂域名
                    return /^[a-zA-Z0-9\-._\[\]:]+$/.test(value.trim());
                }, '请输入有效的IP地址或域名');
            });

            portInput.addEventListener('input', () => {
                validateInput(portInput, (value) => {
                    const port = parseInt(value);
                    return !isNaN(port) && port >= 1 && port <= 65535;
                }, '端口号必须在1-65535范围内');
            });
        });

        // 页面加载时执行自动触发脚本
        (function() {
            ${autoTriggerScript}
        })();
        
        // 全局暴露复制函数供按钮调用
        window.copyToClipboard = copyToClipboard;
    </script>
</body>
</html>`;

    return new Response(html, {headers: {'Content-Type': 'text/html; charset=utf-8'}});
}

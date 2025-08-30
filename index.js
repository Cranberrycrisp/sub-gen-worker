/**
 * Universal Subscription Generator for Clash & Shadowrocket
 * Author: flyrr
 * Version: 4.0 - Added Proxy Chaining (Transit Node) functionality
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
 * 后端 API: 生成 Clash 的 YAML 配置文件
 * - 支持单节点配置
 * - 支持中转+落地链式代理配置
 * @param {Request} request
 */
async function handleClashConfigRequest(request) {
    const {searchParams} = new URL(request.url);

    // --- 落地节点参数 (必须) ---
    // 将 const 改为 let，以允许后续的国旗添加操作
    let landingName = decodeURIComponent(searchParams.get('name') || '落地节点');
    const landingServer = searchParams.get('server');
    const landingPort = searchParams.get('port');
    const landingUsername = decodeURIComponent(searchParams.get('username') || '');
    const landingPassword = decodeURIComponent(searchParams.get('password') || '');
    const landingType = searchParams.get('type') || 'socks5';

    // --- 中转节点参数 (可选) ---
    let transitName = decodeURIComponent(searchParams.get('transit_name') || '中转节点');
    const transitServer = searchParams.get('transit_server');
    const transitPort = searchParams.get('transit_port');
    const transitPassword = decodeURIComponent(searchParams.get('transit_password') || '');
    const transitType = searchParams.get('transit_type') || 'hysteria2';
    const transitSni = searchParams.get('transit_sni') || 'cn.bing.com';
    const transitSkipCertVerify = searchParams.get('transit_skip_cert_verify') === 'true'; // 必须转为布尔值
    const transitAlpn = searchParams.get('transit_alpn') || 'h3';

    // 基础验证
    if (!landingServer || !landingPort) {
        return new Response('Error: Landing node "server" & "port" are required.', {status: 400});
    }

    // --- 辅助函数 ---
    // 国旗映射表
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
    // 国旗添加逻辑
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

    // 对节点名称进行国旗处理
    landingName = addFlagToNodeName(landingName);
    transitName = addFlagToNodeName(transitName);

    const escapeYamlString = (str) => {
        if (str === null || str === undefined) return '';
        // 确保布尔值和数字不被引用
        if (typeof str === 'boolean' || typeof str === 'number') return str.toString();

        const needsQuotes = /[:\[\]{}#&*!|>'"%@`\n\r\t]|\uD83C[\uDDE6-\uDDFF]/u.test(str) || /^\s|\s$/.test(str) || /[\u4e00-\u9fff]/.test(str);
        if (needsQuotes) {
            return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        }
        return str;
    };

    // --- 核心逻辑: 根据是否提供中转节点参数，生成不同配置 ---

    let clashConfig;
    const useTransit = transitServer && transitPort;

    if (useTransit) {
        // --- 生成链式代理 (中转 + 落地) 配置 ---

        // 1. 构建中转节点
        let transitProxy = `
  - name: ${escapeYamlString(transitName)}
    type: ${transitType}
    server: ${transitServer}
    port: ${parseInt(transitPort)}
    password: ${escapeYamlString(transitPassword)}
    sni: ${escapeYamlString(transitSni)}
    skip-cert-verify: ${transitSkipCertVerify}
    alpn:
      - ${transitAlpn}`;

        // 2. 构建落地节点，并使用 dialer-proxy 指向中转
        let landingProxy = `
  - name: ${escapeYamlString(landingName)}
    type: ${landingType}
    server: ${landingServer}
    port: ${parseInt(landingPort)}`;
        if (landingUsername) landingProxy += `
    username: ${escapeYamlString(landingUsername)}`;
        if (landingPassword) landingProxy += `
    password: ${escapeYamlString(landingPassword)}`;
        if (landingType === 'socks5') landingProxy += `
    udp: true`;
        // 关键：指定拨号代理
        landingProxy += `
    dialer-proxy: ${escapeYamlString(transitName)}`;

        // 3. 组合成完整的 YAML，添加 Shadowrocket 链式代理说明
        clashConfig = `
# 🔗 链式代理配置 (中转 + 落地)
# ✅ Clash: 自动链式代理 (中转 → 落地)
# 📱 Shadowrocket: 需要手动设置 (见下方说明)

# 代理服务器列表
proxies:${transitProxy}${landingProxy}

# 代理组配置
proxy-groups:
  # 最终代理模式组
  - name: "🚀 代理模式"
    type: select
    proxies:
      - "♻️ 落地节点-自动"
      - "🔰 落地节点-手动"
      - DIRECT

  # 组A: 中转节点选择组
  - name: "中转节点"
    type: select
    proxies:
      - ${escapeYamlString(transitName)}
      - DIRECT

  # 组B: 落地节点 - 手动选择模式
  - name: "🔰 落地节点-手动"
    type: select
    proxies:
      - ${escapeYamlString(landingName)}

  # 组C: 落地节点 - 自动选择模式
  - name: "♻️ 落地节点-自动"
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    proxies:
      - ${escapeYamlString(landingName)}

# 规则配置
rules:
  - MATCH,🚀 代理模式

# ==================== Shadowrocket 链式代理设置说明 ====================
# 📱 Shadowrocket 用户请按以下步骤手动设置链式代理：
# 
# 🔥 重要提示：Shadowrocket 配置文件无法自动实现链式代理
# 需要在客户端中手动配置"代理通过"功能
#
# 📋 设置步骤：
# 1️⃣ 导入此配置文件到 Shadowrocket
# 2️⃣ 你会看到两个独立节点：
#     • ${transitName} (中转节点)
#     • ${landingName} (落地节点)
# 
# 3️⃣ 设置链式代理：
#     • 点击落地节点 "${landingName}"
#     • 滑动到底部找到"代理通过"选项
#     • 选择 "${transitName}" 作为上游代理
#     • 点击"完成"保存设置
# 
# 4️⃣ 使用链式代理：
#     • 在主界面选择 "${landingName}" 节点
#     • 流量路径：设备 → ${transitName} → ${landingName} → 目标网站
# 
# 💡 提示：Clash 用户无需手动设置，配置文件已自动实现链式代理
`;

    } else {
        // --- 生成单节点配置 (保持原有逻辑) ---
        let proxyNode = `
  - name: ${escapeYamlString(landingName)}
    type: ${landingType}
    server: ${landingServer}
    port: ${parseInt(landingPort)}`;

        if (landingUsername) {
            proxyNode += `
    username: ${escapeYamlString(landingUsername)}`;
        }
        if (landingPassword) {
            proxyNode += `
    password: ${escapeYamlString(landingPassword)}`;
        }
        if (landingType === 'socks5') {
            proxyNode += `
    udp: true`;
        }

        clashConfig = `proxies:${proxyNode}

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - ${escapeYamlString(landingName)}
      - DIRECT

rules:
  - MATCH,🚀 节点选择
`;
    }

    // 最终返回响应
    // 使用落地节点名或"中转配置"作为文件名
    const finalName = useTransit ? `${transitName} - ${landingName}` : landingName;
    return new Response(clashConfig, {
        headers: {
            'Content-Type': 'text/yaml; charset=utf-8',
            'Content-Disposition': `attachment; filename="config.yaml"; filename*=UTF-8''${encodeURIComponent(finalName + '.yaml')}`
        },
    });
}


/**
 * UI: 显示主界面，增加中转节点配置区域
 * @param {Request} request
 */
function handleUIPageRequest(request) {
    const {origin, searchParams} = new URL(request.url);

    // HTML 转义函数
    const escapeHtml = (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    };

    // 从 URL 参数预填充表单
    const prefill = {
        name: decodeURIComponent(searchParams.get('name') || ''),
        type: searchParams.get('type') || 'socks5',
        server: searchParams.get('server') || '',
        port: searchParams.get('port') || '',
        username: decodeURIComponent(searchParams.get('username') || ''),
        password: decodeURIComponent(searchParams.get('password') || ''),
        // 中转节点预填充
        transit_name: decodeURIComponent(searchParams.get('transit_name') || '中转节点'),
        transit_type: searchParams.get('transit_type') || 'hysteria2',
        transit_server: searchParams.get('transit_server') || '',
        transit_port: searchParams.get('transit_port') || '',
        transit_password: decodeURIComponent(searchParams.get('transit_password') || ''),
        transit_sni: searchParams.get('transit_sni') || 'cn.bing.com',
        transit_skip_cert_verify: searchParams.get('transit_skip_cert_verify') !== 'false', // 默认 true
        transit_alpn: searchParams.get('transit_alpn') || 'h3',
        use_transit: !!searchParams.get('transit_server'), // 根据URL参数决定是否勾选
    };

    // 自动触发逻辑
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
        /* 新增样式 */
        .section-title {
            font-size: 20px;
            font-weight: 700;
            color: #333;
            margin-top: 40px;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e1e8ed;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .section-title:first-of-type {
            margin-top: 0;
        }
        .sub-field {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        #transit-fields {
            transition: all 0.4s ease-in-out;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
        }
        #transit-fields.active {
            max-height: 1000px; /* 一个足够大的值 */
            opacity: 1;
        }
        .toggle-switch { display: inline-flex; align-items: center; cursor: pointer; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { width: 44px; height: 24px; background-color: #ccc; border-radius: 24px; position: relative; transition: .4s; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: .4s; }
        input:checked + .slider { background-color: #667eea; }
        input:checked + .slider:before { transform: translateX(20px); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 通用代理订阅生成器</h1>
            <p>一键导入 Clash 和 Shadowrocket 客户端，支持中转链式代理</p>
        </div>
        
        <div id="result"></div>
        
        <form id="proxy-form">
            <!-- 中转节点配置区域 -->
            <div class="section-title">
                <span>1. 中转节点 (跳板机)</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="use-transit-toggle" ${prefill.use_transit ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>

            <div id="transit-fields" class="${prefill.use_transit ? 'active' : ''}">
                <div class="form-group">
                    <label for="transit_name">中转名称:</label>
                    <input type="text" id="transit_name" placeholder="如：香港BGP中转" value="${escapeHtml(prefill.transit_name)}">
                </div>
                <div class="sub-field">
                    <div class="form-group">
                        <label for="transit_type">中转协议:</label>
                        <select id="transit_type">
                            <option value="hysteria2" ${prefill.transit_type === 'hysteria2' ? 'selected' : ''}>Hysteria2</option>
                            <option value="socks5" ${prefill.transit_type === 'socks5' ? 'selected' : ''}>SOCKS5</option>
                             <option value="http" ${prefill.transit_type === 'http' ? 'selected' : ''}>HTTP</option>
                        </select>
                    </div>
                     <div class="form-group">
                        <label for="transit_port" class="required">中转端口:</label>
                        <input type="number" id="transit_port" placeholder="1-65535" value="${escapeHtml(prefill.transit_port)}">
                    </div>
                </div>
                <div class="form-group">
                    <label for="transit_server" class="required">中转服务器:</label>
                    <input type="text" id="transit_server" placeholder="IP 地址或域名" value="${escapeHtml(prefill.transit_server)}">
                </div>
                <div class="form-group">
                    <label for="transit_password">中转密码/密钥:</label>
                    <input type="text" id="transit_password" placeholder="Hysteria2的password" value="${escapeHtml(prefill.transit_password)}">
                </div>
                <p style="font-size: 13px; color: #666;">Hysteria2 专用参数:</p>
                <div class="sub-field">
                    <div class="form-group">
                        <label for="transit_sni">SNI:</label>
                        <input type="text" id="transit_sni" value="${escapeHtml(prefill.transit_sni)}">
                    </div>
                    <div class="form-group">
                        <label for="transit_alpn">ALPN:</label>
                        <input type="text" id="transit_alpn" value="${escapeHtml(prefill.transit_alpn)}">
                    </div>
                </div>
                 <div class="form-group">
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="transit_skip_cert_verify" style="width:auto; margin-right: 8px;" ${prefill.transit_skip_cert_verify ? 'checked' : ''}>
                        跳过证书验证 (skip-cert-verify)
                    </label>
                </div>
            </div>

             <!-- 落地节点配置区域 -->
            <div class="section-title">
                <span>2. 落地节点 (出口)</span>
            </div>
            
            <div class="form-group">
                <label for="name">落地名称:</label>
                <input type="text" id="name" placeholder="如：澳洲落地节点" value="${escapeHtml(prefill.name || '落地节点')}">
            </div>
            
            <div class="form-group">
                <label for="type">落地协议:</label>
                <select id="type">
                    <option value="socks5" ${prefill.type === 'socks5' ? 'selected' : ''}>SOCKS5</option>
                    <!-- 未来可扩展: http, ss, vmess, trojan 等 -->
                </select>
                <div class="protocol-info">💡 当前支持 SOCKS5 协议，后续版本将支持更多协议类型</div>
            </div>

            <div class="form-group">
                <label for="server" class="required">落地服务器:</label>
                <input type="text" id="server" placeholder="IP 地址或域名" value="${escapeHtml(prefill.server)}" required>
            </div>

            <div class="form-group">
                <label for="port" class="required">落地端口:</label>
                <input type="number" id="port" placeholder="1-65535" min="1" max="65535" value="${escapeHtml(prefill.port)}" required>
            </div>

            <div class="form-group">
                <label for="username">落地用户名:</label>
                <input type="text" id="username" placeholder="可选" value="${escapeHtml(prefill.username)}">
            </div>

            <div class="form-group">
                <label for="password">落地密码:</label>
                <input type="password" id="password" placeholder="可选" value="${escapeHtml(prefill.password)}">
            </div>

            <div class="button-group" style="margin-top:40px;">
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
        // --- 切换中转配置区域的显示 ---
        const transitToggle = document.getElementById('use-transit-toggle');
        const transitFields = document.getElementById('transit-fields');
        transitToggle.addEventListener('change', () => {
            transitFields.classList.toggle('active', transitToggle.checked);
        });

        const getFormValues = () => {
            const useTransit = document.getElementById('use-transit-toggle').checked;
            
            const values = {
                // 落地节点
                name: document.getElementById('name').value.trim() || '落地节点',
                type: document.getElementById('type').value.trim(),
                server: document.getElementById('server').value.trim(),
                port: document.getElementById('port').value.trim(),
                username: document.getElementById('username').value.trim(),
                password: document.getElementById('password').value.trim(),
            };

            if (useTransit) {
                // 如果启用中转，则收集中转节点信息
                Object.assign(values, {
                    transit_name: document.getElementById('transit_name').value.trim() || '中转节点',
                    transit_type: document.getElementById('transit_type').value.trim(),
                    transit_server: document.getElementById('transit_server').value.trim(),
                    transit_port: document.getElementById('transit_port').value.trim(),
                    transit_password: document.getElementById('transit_password').value.trim(),
                    transit_sni: document.getElementById('transit_sni').value.trim(),
                    transit_skip_cert_verify: document.getElementById('transit_skip_cert_verify').checked,
                    transit_alpn: document.getElementById('transit_alpn').value.trim(),
                });
            }
            
            return values;
        };

        const validateForm = (values) => {
            // 基础验证：落地节点必须有
            if (!values.server || !values.port) {
                showMessage('⚠️ 落地节点的服务器和端口是必填项！', 'error'); return false;
            }

            // 中转验证：如果启用中转，中转节点也必须有服务器和端口
            if (document.getElementById('use-transit-toggle').checked && (!values.transit_server || !values.transit_port)) {
                 showMessage('⚠️ 启用中转时，中转节点的服务器和端口是必填项！', 'error'); return false;
            }

            return true;
        }
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
        
        // 正确编码 URL 参数（处理中文）
        const buildConfigUrl = (origin, values) => {
            const params = new URLSearchParams();
            Object.entries(values).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                    params.set(key, value);
                }
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
          
            // ✅ 使用统一的验证函数
            if (!validateForm(values)) {
                return;
            }
            if (isNaN(parseInt(values.port)) || parseInt(values.port) < 1 || parseInt(values.port) > 65535) {
                showMessage('⚠️ 端口号必须在 1-65535 范围内！', 'error'); return;
            }

            try {
                // 两个客户端都使用同一个配置文件 URL
                const configUrl = buildConfigUrl(location.origin, values);
                let protocolLink, linkText, warningText = '';

                if (client === 'clash') {
                    protocolLink = generateClashLink(configUrl);
                    linkText = '正在生成 Clash 订阅并拉起客户端...';
                } else if (client === 'shadowrocket') {
                    protocolLink = generateShadowrocketSubLink(configUrl);
                    linkText = '正在生成 Shadowrocket 订阅并拉起客户端...';
                    
                    // 为 Shadowrocket 链式代理添加详细说明（使用字符串拼接）
                    if (document.getElementById('use-transit-toggle').checked) {
                        const transitName = values.transit_name || '中转节点';
                        const landingName = values.name || '落地节点';
                        
                        warningText = '' +
                            '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; padding: 20px; margin-top: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);">' +
                                '<div style="display: flex; align-items: center; margin-bottom: 15px;">' +
                                    '<span style="font-size: 24px; margin-right: 10px;">📱</span>' +
                                    '<strong style="font-size: 18px;">Shadowrocket 链式代理设置指南</strong>' +
                                '</div>' +
                                
                                '<div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 15px; margin-bottom: 15px;">' +
                                    '<p style="margin: 0; font-size: 14px; opacity: 0.9;">' +
                                        '⚠️ <strong>重要：</strong>Shadowrocket 无法通过配置文件自动实现链式代理<br>' +
                                        '需要在客户端中手动设置"代理通过"功能' +
                                    '</p>' +
                                '</div>' +
                                
                                '<div style="font-size: 15px; line-height: 1.6;">' +
                                    '<p style="margin: 10px 0; font-weight: 600;">🔧 设置步骤：</p>' +
                                    '<div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 12px; font-family: monospace;">' +
                                        '1️⃣ 导入配置后，你会看到两个独立节点<br>' +
                                        '2️⃣ 点击落地节点 <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">' + landingName + '</code> 后面的ⓘ <br>' +
                                        '3️⃣ 找到 <strong>"代理通过"</strong> 选项<br>' +
                                        '4️⃣ 选择 <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">' + transitName + '</code> 作为上游代理<br>' +
                                        '5️⃣ 点击 <strong>"完成"</strong> 保存设置' +
                                    '</div>' +
                                    
                                    '<p style="margin: 15px 0 5px 0; font-weight: 600;">🎯 使用链式代理：</p>' +
                                    '<div style="background: rgba(46, 204, 113, 0.2); border: 1px solid rgba(46, 204, 113, 0.4); border-radius: 6px; padding: 10px; font-size: 14px;">' +
                                        '在主界面选择 <strong>' + landingName + '</strong> 节点<br>' +
                                        '流量路径：<span style="font-family: monospace;">设备 → ' + transitName + ' → ' + landingName + ' → 目标网站</span>' +
                                    '</div>' +
                                    
                                    '<p style="margin: 10px 0 0 0; font-size: 13px; opacity: 0.8;">' +
                                        '💡 提示：Clash 用户无需手动设置，已自动实现链式代理' +
                                    '</p>' +
                                '</div>' +
                            '</div>';
                    }
                } else {
                    showMessage('❌ 不支持的客户端类型', 'error'); return;
                }
                
                // [修改] 显示订阅链接和警告信息
                document.getElementById('result').innerHTML = 
                    '<div class="success">' + linkText + '</div>' +
                    '<p style="font-size: 13px; color: #666; margin-top: 10px;">' +
                        '如果没有自动拉起，请复制下方通用订阅链接手动导入：' +
                    '</p>' +
                    '<div class="link-display">' + configUrl + '</div>' +
                    '<div class="copy-buttons">' +
                        '<button class="btn btn-copy btn-small" onclick="copyToClipboard(&quot;' + configUrl + '&quot;)">' +
                            '📋 复制通用订阅链接' +
                        '</button>' +
                    '</div>' +
                    warningText;
                
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

<div align="center">

# 🔁 sub-gen-worker 

<p align="center">
  一个部署在 Cloudflare Workers 上的轻量级代理订阅生成器。
  <br />
  将单个节点信息，一键生成为 Clash、Shadowrocket 客户端兼容的完整订阅，支持 Web UI 界面 + API 参数化调用。
  <br />
  <strong>🆕 支持中转+落地链式代理配置</strong>
</p>

</div>

<div align="center">

![功能](https://img.shields.io/badge/功能-订阅转换-blue)![语言](https://img.shields.io/badge/JavaScript-ES6+-f7df1e)![环境](https://img.shields.io/badge/环境-Cloudflare_Workers-f38020)![协议](https://img.shields.io/github/license/Cranberrycrisp/sub-gen-worker)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Cranberrycrisp/sub-gen-worker)

</div>


## 特性

-   **多模式使用**：Web UI 界面 + API 参数化调用
-   **🆕 链式代理**：支持中转+落地两级代理配置
-   **一键导入**：自动唤起客户端导入配置
-   **动态配置**：API 传参可以结合其他自动化使用，例如在Excel或多维表格等应用中通过公式拼接到本项目 API，一键订阅
-   **智能旗标**：自动识别地区并添加旗帜标识
-   **零成本部署**：基于 Cloudflare Workers



## 部署

### 方式一：一键部署
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Cranberrycrisp/sub-gen-worker) 

### 方式二：手动部署
1. 登录 Cloudflare 控制台 → Workers & Pages
2. 创建 Worker → 编辑代码
3. 粘贴 `index.js` 内容 → 保存并部署

> 部署完成后，即可通过 `https://<worker-name>.<subdomain>.workers.dev` 访问。
> 为防止 `workers.dev` 域名被墙，建议在 Cloudflare 上为 Worker 添加自定义域名。

## 使用方式

本项目提供两种主要使用方式：Web UI 和 API 调用。

### 1. Web UI 模式

直接在浏览器中访问您部署的 Worker URL。该界面提供了一个交互式表单，支持：

- **单节点配置**：直接配置落地节点
- **🆕 链式代理配置**：配置中转节点+落地节点的两级代理

![Web UI Screenshot](https://raw.githubusercontent.com/Cranberrycrisp/sub-gen-worker/refs/heads/main/img/index.jpg)


### 2. API 调用模式

通过构造特定的 URL 参数，可直接生成配置并触发客户端导入。

![API UI Screenshot](https://raw.githubusercontent.com/Cranberrycrisp/sub-gen-worker/refs/heads/main/img/index-api.jpg)


#### 端点 (Endpoint)

```
https://<Your-Worker-URL>/?<parameters>
```

#### 基础参数 (落地节点)

| 参数 | 类型 | 必需 | 描述 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | **是** | 落地节点名称 | `香港节点-01` |
| `server` | `string` | **是** | 落地服务器地址 | `1.2.3.4` |
| `port` | `number` | **是** | 落地端口 | `1080` |
| `type` | `string` | 否 | 落地协议类型 (默认 `socks5`) | `socks5` |
| `username` | `string` | 否 | 落地用户名 (可选) | `user` |
| `password` | `string` | 否 | 落地密码 (可选) | `pass` |

#### 🆕 中转节点参数 (可选)

| 参数 | 类型 | 必需 | 描述 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `transit_name` | `string` | 否 | 中转节点名称 | `AU-NAT-02中转节点` |
| `transit_server` | `string` | 否* | 中转服务器地址 | `transit.example.com` |
| `transit_port` | `number` | 否* | 中转端口 | `44311` |
| `transit_type` | `string` | 否 | 中转协议类型 (默认 `hysteria2`) | `hysteria2`/`socks5`/`http` |
| `transit_password` | `string` | 否 | 中转密码/密钥 | `your-password` |
| `transit_sni` | `string` | 否 | SNI (默认 `cn.bing.com`) | `cn.bing.com` |
| `transit_skip_cert_verify` | `boolean` | 否 | 跳过证书验证 (默认 `true`) | `true`/`false` |
| `transit_alpn` | `string` | 否 | ALPN (默认 `h3`) | `h3` |

> **注意**：标记为 `否*` 的参数表示：当需要使用链式代理时，这些参数变为必需。

#### 调用示例

**单节点配置：**
```
https://sub-gen.flyrr.cc/?server=1.2.3.4&port=1080&username=user&password=pass&name=香港节点-01
```

**🆕 链式代理配置：**
```
https://sub-gen.flyrr.cc/?name=我的落地节点&type=socks5&server=1.2.3.4&port=6839&username=user&password=pass&transit_name=AU-NAT-02中转节点&transit_type=hysteria2&transit_server=1.2.3.4&transit_port=44311&transit_password=pass&transit_sni=cn.bing.com&transit_skip_cert_verify=true&transit_alpn=h3
```

## 🔗 链式代理说明

### Clash 客户端
- ✅ **自动支持**：配置文件会自动使用 `dialer-proxy` 实现链式代理
- 流量路径：`设备 → 中转节点 → 落地节点 → 目标网站`

### Shadowrocket 客户端
- ⚠️ **需要手动设置**：由于 Shadowrocket 配置文件限制，需要手动配置
- 📋 **设置步骤**：
  1. 导入配置文件后，会看到两个独立节点
  2. 点击落地节点，滑动到底部找到"代理通过"选项
  3. 选择中转节点作为上游代理
  4. 点击"完成"保存设置
  5. 在主界面选择落地节点使用

### 支持的协议组合

| 中转节点 | 落地节点 | 状态 |
| :--- | :--- | :--- |
| Hysteria2 | SOCKS5 | ✅ 支持 |
| SOCKS5 | SOCKS5 | ✅ 支持 |
| HTTP | SOCKS5 | ✅ 支持 |

可编辑 `index.js` 文件中的自定义默认的代理组 (`proxy-groups`) 和分流规则 (`rules`)。

## 技术实现

-   **前端界面**：根路径 `/` 返回一个包含表单和客户端交互逻辑的 HTML 页面。
-   **后端 API**：路径 `/config` 接收 URL 查询参数，动态生成 YAML 格式的配置文件，供客户端订阅。
-   **链式代理**：Clash 使用 `dialer-proxy` 实现，Shadowrocket 需手动配置"代理通过"功能。
-   **URL Scheme**：
    -   Clash: `clash://install-config?url=<ENCODED_CONFIG_URL>`
    -   Shadowrocket: `shadowrocket://add/<ENCODED_CONFIG_URL>`
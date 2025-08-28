# sub-gen-worker

<p align="center">
  <img src="https://raw.githubusercontent.com/Cranberrycrisp/sub-gen-worker/refs/heads/main/img/index.jpg" alt="Web UI Screenshot" width="600"/>
</p>

<p align="center">
  一个部署在 Cloudflare Workers 上的轻量级代理订阅生成器。
  <br />
  将单个节点信息，一键生成为 Clash、Shadowrocket 客户端兼容的完整订阅，支持 API 传参和 Web 界面。
</p>

<p align="center">
  <!-- 可以添加一些徽章增加专业感 -->
  <a href="https://github.com/Cranberrycrisp/sub-gen-worker/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Cranberrycrisp/sub-gen-worker?style=flat-square" alt="License"></a>
  <a href="https://github.com/Cranberrycrisp/sub-gen-worker"><img src="https://img.shields.io/github/stars/Cranberrycrisp/sub-gen-worker?style=flat-square" alt="Stars"></a>
</p>

## 特性

-   **多模式使用**：Web UI 界面 + API 参数化调用
-   **一键导入**：自动唤起客户端导入配置
-   **动态配置**：API 使用场景，例如在Excel或多维表格等应用中通过公式拼接到本项目 API，一键订阅
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

直接在浏览器中访问您部署的 Worker URL。该界面提供了一个交互式表单，填写节点信息后，点击对应按钮即可生成配置并导入客户端。


![Web UI Screenshot](https://raw.githubusercontent.com/Cranberrycrisp/sub-gen-worker/refs/heads/main/img/index.jpg)


### 2. API 调用模式

通过构造特定的 URL 参数，可直接生成配置并触发客户端导入。

![API UI Screenshot](https://raw.githubusercontent.com/Cranberrycrisp/sub-gen-worker/refs/heads/main/img/index-api.jpg)


#### 端点 (Endpoint)

```
https://<Your-Worker-URL>/?<parameters>
```

#### 请求参数


| 参数 | 类型 | 必需 | 描述 | 示例 |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | **是** | 节点名称 | `香港节点-01` |
| `server` | `string` | **是** | 服务器地址 | `1.2.3.4` |
| `port` | `number` | **是** | 端口 | `1080` |
| `type` | `string` | 否 | 协议类型 (默认 `socks5`) | `socks5` |
| `username` | `string` | 否 | 用户名 (可选) | `user` |
| `password` | `string` | 否 | 密码 (可选) | `pass` |


#### 调用示例


```
https://sub-gen.flyrr.cc/?server=1.2.3.4&port=1080&username=user&password=pass&name=香港节点-01
```

可编辑 `index.js` 文件中的 `clashTemplate` 变量，自定义默认的代理组 (`proxy-groups`) 和分流规则 (`rules`)。

## 技术实现

-   **前端界面**：根路径 `/` 返回一个包含表单和客户端交互逻辑的 HTML 页面。
-   **后端 API**：路径 `/config` 接收 URL 查询参数，动态生成 YAML 格式的配置文件，供客户端订阅。
-   **URL Scheme**：
    -   Clash: `clash://install-config?url=<ENCODED_CONFIG_URL>`
    -   Shadowrocket: `shadowrocket://add/<ENCODED_CONFIG_URL>`
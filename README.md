# 我的信息保险箱

> 个人信息安全记录工具 — 安全存储账号密码、证件信息、重要文件等个人数据

## 功能特性

- **多分类管理** — 账号密码、入党入团、文件、其他，支持自定义分类 + 自定义字段
- **敏感信息脱敏** — 密码等敏感字段默认打码显示，点击眼睛图标才展示原文
- **修改历程** — 每次操作自动记录快照，支持差异对比，完整追溯变更历史
- **回收站** — 软删除保护，7 天自动清理，支持一键恢复
- **文件附件** — 上传、预览（图片/PDF/视频/音频）、下载，单文件最大 10MB
- **数据仪表盘** — 分类分布饼图、7 天活动趋势、统计数据概览
- **Excel 导出** — 按分类批量导出为 .xlsx 文件
- **标签系统** — 自由打标签，快速筛选
- **搜索过滤** — 按名称模糊搜索、分类筛选、标签筛选
- **一键复制** — 账号等字段一键复制到剪贴板

## 技术栈

| 层级   | 技术                                                                  |
| ------ | --------------------------------------------------------------------- |
| 框架   | TanStack Start + TanStack Router + TanStack Query                     |
| UI     | React 19 · shadcn/ui (new-york) · Tailwind CSS v4 · Recharts · Lucide |
| 数据库 | MySQL (mysql2/promise)                                                |
| 认证   | JWT (jsonwebtoken + bcryptjs)                                         |
| 构建   | Vite 8 · Nitro · TypeScript                                           |
| 导出   | SheetJS (xlsx)                                                        |

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 5.7
- npm

### 安装

```bash
git clone https://github.com/your-username/xiuyi-info-keeper-log.git
cd xiuyi-info-keeper-log
npm install
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 MySQL 连接信息和 JWT 密钥：

```
MYSQL_HOST="127.0.0.1"
MYSQL_PORT=3306
MYSQL_USER="root"
MYSQL_PASSWORD="your-password"
MYSQL_DATABASE="vault"

JWT_SECRET="your-secret-key-at-least-32-chars"
JWT_EXPIRES_IN="7d"
```

### 初始化数据库

在 MySQL 中执行以下建表语句（见下方「数据库表结构」章节），然后启动开发服务器：

```bash
npm run dev
```

访问 http://localhost:8080

## 数据库表结构

### users 用户表

```sql
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### items 信息条目表

```sql
CREATE TABLE items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  tags JSON,
  account TEXT,
  password_hint TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  extra JSON NOT NULL DEFAULT (JSON_OBJECT()),
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_items_user_id (user_id),
  INDEX idx_items_deleted_at (deleted_at),
  INDEX idx_items_category (category)
);
```

### item_history 修改历史表

```sql
CREATE TABLE item_history (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  action VARCHAR(20) NOT NULL,
  snapshot JSON NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_history_item (item_id, changed_at DESC)
);
```

### item_attachments 附件表

```sql
CREATE TABLE item_attachments (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_attach_item (item_id),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

## 项目结构

```
src/
├── actions/               # 服务端函数（API）
│   ├── auth.ts            # 注册 / 登录 / 获取当前用户
│   ├── items.ts           # 信息条目 CRUD + 回收站
│   ├── attachments.ts     # 附件查询 / 删除
│   ├── history.ts         # 修改历史查询 / 删除
│   └── upload.ts          # 文件上传 / 下载
├── components/
│   ├── ItemForm.tsx       # 信息创建/编辑表单
│   ├── NewCategoryDialog  # 自定义分类创建
│   ├── ConfirmDialog.tsx  # 全局确认弹窗
│   ├── AttachmentPreview  # 附件预览
│   └── ui/                # shadcn/ui 组件
├── hooks/                 # 自定义 Hooks
├── lib/                   # 工具函数
│   ├── vault.ts           # 分类定义、脱敏、快照对比
│   ├── auth-attacher.ts   # 请求认证中间件
│   └── client-auth.ts     # 客户端认证状态
├── routes/                # 页面路由
│   ├── index.tsx          # 首页（已登录则跳转仪表盘）
│   ├── auth.tsx           # 登录 / 注册
│   └── _authenticated/    # 需要认证的页面
│       ├── dashboard.tsx  # 数据仪表盘
│       ├── items.index    # 信息列表
│       ├── items.new      # 新建信息
│       ├── items.$id      # 信息详情
│       └── trash.tsx      # 回收站
├── server/                # 服务端代码
│   ├── db.ts              # MySQL 连接池
│   ├── auth.ts            # JWT 签发 / 验证
│   └── repositories/      # 数据库查询
├── server.ts              # SSR 入口（错误处理包装）
└── styles.css             # 全局样式 + 主题
```

## 命令

```bash
npm run dev        # 启动开发服务器
npm run build      # 生产构建
npm run lint       # ESLint 检查
npm run format     # Prettier 格式化
```

## License

MIT

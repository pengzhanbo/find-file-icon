# find-file-icon

[![npm version](https://img.shields.io/npm/v/find-file-icon.svg)](https://www.npmjs.com/package/find-file-icon)
[![license](https://img.shields.io/npm/l/find-file-icon.svg)](https://github.com/pengzhanbo/find-file-icon/blob/main/LICENSE)

[English](README.md) | 简体中文

给定一个文件路径，返回与之匹配的 [Iconify](https://iconify.design/) 图标名——编辑器的文件树做的就是这件事，只是不必把编辑器一起带上。

```ts
import { findFileIcon } from 'find-file-icon'

findFileIcon('src/components/Button.vue')
// { type: 'file', name: 'vscode-icons:file-type-vue' }

findFileIcon('src/')
// { type: 'folder', name: 'vscode-icons:folder-type-src', expandedName: 'vscode-icons:folder-type-src-opened' }

findFileIcon('unknown.xyz')
// { type: 'file', name: 'vscode-icons:default-file' }
```

每次查找都是一次同步查表：没有 I/O，没有异步，也没有运行时依赖。该包为纯 ESM 实现，每套图标集合各占一个子路径，导入其中一套不会连带加载另一套的数据。

## 安装

```bash
pnpm add find-file-icon
npm install find-file-icon
yarn add find-file-icon
```

## 使用

### 选择图标集合

根入口默认按 `vscode-icons` 查找。若要用另一套，导入对应的子路径：

```ts
import { findFileIcon as catppuccinIcon } from 'find-file-icon/catppuccin'
import { findFileIcon as vscodeIcon } from 'find-file-icon/vscode-icons'

catppuccinIcon('src/components/Button.vue')
// { type: 'file', name: 'catppuccin:vue' }

catppuccinIcon('src/')
// { type: 'folder', name: 'catppuccin:folder-src', expandedName: 'catppuccin:folder-src-open' }

vscodeIcon('package.json')
// { type: 'file', name: 'vscode-icons:file-type-npm' }
```

### 渲染结果

`name` 就是完整的 Iconify 图标名，可直接交给任意 Iconify 渲染器。

```ts
// Vue
import { Icon } from '@iconify/vue'
// <Icon :icon="findFileIcon('src/index.ts').name" />
```

```html
<!-- Web Component -->
<iconify-icon icon="vscode-icons:file-type-vue"></iconify-icon>
```

### 自定义图标集合

`createFinder` 可以把任意 `IconSet` 编译成查找器。内置的两套图标集合便是这样构建的，对于本包未收录的图标集合，这也是唯一的接入方式：

```ts
import { createFinder, type IconSet } from 'find-file-icon'

const myIcons: IconSet = {
  collect: 'my-icons',
  // 图标名前缀，以及文件夹展开态后缀
  filePrefix: 'file-',
  folderPrefix: 'folder-',
  folderExpandedSuffix: '-opened',
  // 未匹配到任何规则时返回的图标
  defaults: { file: 'default-file', folder: 'default-folder' },
  // 图标名 -> 精确文件名
  fileNames: { markdown: ['readme.md'] },
  // 图标名 -> 精确文件夹名
  folderNames: { src: ['src', 'source'] },
  // 图标名 -> 扩展名（不含前导点）
  fileExtensions: { typescript: ['ts', 'tsx'] },
  // 图标名 -> 文件名规则
  fileStems: { dotenv: [{ name: '.env', extensions: '*' }] },
}

const findIcon = createFinder(myIcons)

findIcon('src/index.ts')
// { type: 'file', name: 'my-icons:file-typescript' }

findIcon('src/')
// { type: 'folder', name: 'my-icons:folder-src', expandedName: 'my-icons:folder-src-opened' }
```

其中只有 `collect` 与 `defaults` 为必填：集合前缀与兜底图标，缺了它们就拼不出合法的图标名。四张查找表均可选，缺省即空表，因此只需声明用得到的部分。

`createFinder` 也可从 `find-file-icon/core` 导入，该入口只含查找逻辑，不附带任何图标集合数据。内置的两套图标集合以原始的 `IconSet` 定义发布于 `find-file-icon/icon-set/vscode-icons` 与 `find-file-icon/icon-set/catppuccin`，自定义集合可以直接在其基础上扩展，而不必从零编写：

```ts
import { createFinder } from 'find-file-icon/core'
import { vscodeIcons } from 'find-file-icon/icon-set/vscode-icons'

const findIcon = createFinder({
  ...vscodeIcons,
  fileExtensions: { ...vscodeIcons.fileExtensions, typescript: ['ts', 'tsx'] },
})
```

## API

### `findFileIcon(input, type?)`

根入口与各个图标集合子路径导出的查找器。

- `input: string` — 文件路径或文件名，不必在磁盘上真实存在。
- `type?: 'file' | 'folder'` — 声明 `input` 是文件还是文件夹。已知类型时请显式传入：不传的话，查找器只能根据路径自行推断。
- 返回值：`type` 为 `'file'` 时是 `FileIconInfo`，为 `'folder'` 时是 `FolderIconInfo`，未传入时是 `IconInfo`。

```ts
findFileIcon('src/index.ts', 'file')
// { type: 'file', name: 'vscode-icons:file-type-typescript' }

findFileIcon('src', 'folder')
// { type: 'folder', name: 'vscode-icons:folder-type-src', expandedName: 'vscode-icons:folder-type-src-opened' }
```

查找器不会返回 `null` 或 `undefined`：匹配不到任何规则的路径会经由默认图标兜底；非字符串输入按空路径处理，同样如此。

### `createFinder(iconSet)`

由 `IconSet` 构建 `IconFinder`。图标集合只在构造时展平一次，此后每次调用都是查表。参见[自定义图标集合](#自定义图标集合)。

构造是整个库唯一会抛错的地方：缺少 `collect` 或 `defaults` 的图标集合会在此处以 `TypeError` 报告缺失字段，而不是等到某次查找时冒出一个 `undefined:file` 的图标名。校验只覆盖这些必填字段——四张查找表与每条 `IconSetStemRule` 的形状属于 TypeScript 类型契约，运行时不做校验，因此来自 JSON 或纯 JS 且不符合 `IconSet` 的定义可能解析出错误图标，而不是抛错。

### 类型

| 类型              | 说明                                                     |
| ----------------- | -------------------------------------------------------- |
| `IconType`        | `'file' \| 'folder'`                                     |
| `FileIconInfo`    | `{ type: 'file', name: string }`                         |
| `FolderIconInfo`  | `{ type: 'folder', name: string, expandedName: string }` |
| `IconInfo`        | `FileIconInfo \| FolderIconInfo`                         |
| `IconFinder`      | 查找器签名，依 `type` 提供重载                           |
| `IconSet`         | `createFinder` 消费的图标集合定义                        |
| `IconSetDefaults` | 默认图标名：`{ file, folder, folderExpanded? }`          |
| `IconSetStemRule` | 文件名规则：`{ name, extensions, exact? }`               |

## 匹配行为

### 路径归一化

匹配发生在输入路径的最后一段上，且已转为小写：`\` 与连续分隔符先统一为 `/`，因此 `src//components//`、`src\components\` 与 `src/components` 都归到 `components`。由此带来两个值得留意的结果。其一，匹配不区分大小写，`Dockerfile` 与 `dockerfile` 落在同一个图标上。其二，非字符串输入（如 `undefined`）按空路径处理，回落到默认图标，而不是抛错。

### 类型判定

未指定 `type` 时：

1. 结尾的分隔符足以定论——输入是文件夹，此时只查文件夹表。
2. 否则先查文件表，再查文件夹表。
3. 都没命中，返回默认文件图标。

显式传入 `type` 可以免去这层推断，同时也决定了兜底图标：`type: 'folder'` 下未命名的路径返回默认文件夹图标，而非默认文件图标。

### 查找顺序

文件的查找顺序如下：

1. `fileNames` 中的精确匹配。
2. `fileStems` 中的规则，按声明顺序。
3. `fileExtensions` 中的扩展名匹配。从第一个 `.` 开始向右扫描，最长后缀优先：`bundle.js.map` 先命中 `js.map`，再轮到 `map`。

文件夹则仅按文件夹名精确匹配。

### 文件名规则

`IconSetStemRule` 是一个联合类型：`extensions` 决定规则采用哪种形态，通配形态下 `exact` 会被类型系统直接拒绝。

| 字段         | 类型              | 说明                                                                                              |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------- |
| `name`       | `string`          | 文件名；当 `exact` 为 `false` 时表示文件名前缀                                                    |
| `extensions` | `string[] \| '*'` | 允许的扩展名（不含前导点）；`'*'` 表示接受任意后缀                                                |
| `exact`      | `boolean`         | 默认为 `true`，要求文件名完全一致；为 `false` 时，只要以 `name` 开头，且其后紧跟 `.` 继续下去即可 |

- `extensions: ['js', 'ts']` 配合默认的 `exact: true` 会展开为精确文件名。`{ name: 'foo.config', extensions: ['js', 'ts'] }` 只匹配 `foo.config.js` 与 `foo.config.ts`，别无其它。
- `exact: false` 按前缀匹配。`{ name: 'jest.config', extensions: ['js', 'ts'], exact: false }` 可匹配 `jest.config.js` 与 `jest.config.local.js`，但不会匹配 `jest.configuration.js`。
- `extensions: '*'` 匹配 `name` 本身或任意 `name.<后缀>`。`{ name: '.env', extensions: '*' }` 可匹配 `.env`、`.env.local` 与 `.env.development`，但不会匹配 `.envrc`。该形态下 `exact` 不生效，必须省略。

### 默认图标

| 图标集合       | 集合前缀       | 默认文件图标   | 默认文件夹图标   | 展开态后缀 |
| -------------- | -------------- | -------------- | ---------------- | ---------- |
| `vscode-icons` | `vscode-icons` | `default-file` | `default-folder` | `-opened`  |
| `catppuccin`   | `catppuccin`   | `file`         | `folder`         | `-open`    |

与其它结果一样，默认图标也带集合前缀，例如 `vscode-icons:default-file`。

## 开发

```bash
pnpm install

# 构建到 dist/（ESM + 类型声明）
pnpm build

# 单元测试
pnpm test

# 代码检查与格式校验
pnpm lint

# 代码检查并自动修复，随后格式化
pnpm format
```

`src/icon-set/` 下的图标数据可用 `pnpm validate` 对照 Iconify 数据集校验，它会报告未知图标、永不命中的条目、重复匹配以及顺序歧义。`pnpm build` 还会把包打包并对其运行 [publint](https://publint.dev)，让 `exports` 配置错误或类型无法解析这类问题在发布前就被拦截。

## 许可证

[MIT](./LICENSE) © [pengzhanbo](https://github.com/pengzhanbo)

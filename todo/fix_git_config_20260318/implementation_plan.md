# 目标：配置 Git 用户信息

针对用户提供的 Git 配置错误提示，本项目将配置 Git 的全局或本地 `user.name` 和 `user.email`。

## 用户审核请求

> [!IMPORTANT]
> 我需要确定您希望使用的 Git 用户名和电子邮箱。
> 或者，如果您同意，我可以尝试从您的系统环境中搜寻现有的配置，或使用 `ideeinfo` 作为默认用户名。

## 建议变更

### Git 配置

- 执行 `git config --global user.name "Your Name"`
- 执行 `git config --global user.email "your.email@example.com"`

## 验证计划

- 执行 `git config user.name` 和 `git config user.email` 确认配置已生效。

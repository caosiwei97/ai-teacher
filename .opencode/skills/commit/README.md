# commit

Git 提交与推送自动化 Skill。

## 功能

- **暂存区优先**：已暂存的文件直接提交，不重新 git add，尊重用户的暂存边界
- 自动暂存变更并生成符合仓库风格的提交信息
- 从 git 历史检测提交信息风格（语义化/简洁/极简、中文/英文）
- 大量变更自动拆分为原子提交单元
- 推送前自动 fetch + rebase，检测并报告冲突
- Hook 错误自动修复（eslint --fix、prettier --write）
- 冲突需用户确认后才处理，绝不自动解决
- 无署名、无 co-author

## 安装

```bash
npx skills add caosiwei97/agent-skills --path skills/commit
```

## 使用

在你的 AI agent 终端中输入：

```
/commit
```

或使用触发词：提交、commit、推送、push、提交代码、commit and push、提交变更。

## License

MIT

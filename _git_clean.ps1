Set-Location "d:\workplace_home\WeSave"
# 从索引中移除 node_modules（保留本地目录）
git rm --cached -r 'Page/node_modules/' 2>&1 | Out-Null
git rm --cached -r 'Server/node_modules/' 2>&1 | Out-Null
# 同样移除数据库相关文件
git rm --cached -r 'Server/data/' 2>&1 | Out-Null
git add -A 2>&1 | Out-Null
# 清理临时脚本
Remove-Item '_git_add.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item '_git_clean.ps1' -Force -ErrorAction SilentlyContinue
Remove-Item '_git_commit.ps1' -Force -ErrorAction SilentlyContinue
$msg = 'chore: exclude node_modules and SQLite data files from git tracking; add gitignore, changelog, seed'
git commit -m $msg 2>&1 | Select-Object -Last 8

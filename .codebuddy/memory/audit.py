#!/usr/bin/env python3
"""
审计校准日志，扫描最近 N 天的错误模式，输出分析报告。
用法:
  python3 audit.py                    # 默认扫最近 7 天
  python3 audit.py --days 30          # 扫最近 30 天
  python3 audit.py --output report    # 输出到 report.md 文件
"""
import os
import re
import sys
from datetime import datetime, timedelta
from collections import defaultdict

MEMORY_DIR = os.path.dirname(os.path.abspath(__file__))
MEMORY_FILE = os.path.join(MEMORY_DIR, "MEMORY.md")

def get_calibration_files(days=7):
    """获取最近 N 天的校准日志文件"""
    files = []
    today = datetime.now()
    for i in range(days):
        date = today - timedelta(days=i)
        filename = date.strftime("%Y-%m-%d.md")
        filepath = os.path.join(MEMORY_DIR, filename)
        if os.path.exists(filepath):
            files.append((filename, filepath))
    return sorted(files)

def parse_errors(filepath):
    """从校准日志中提取错误记录"""
    errors = []
    current_section = None
    current_error = {}
    
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    for line in lines:
        line = line.rstrip()
        
        # 检测章节标题
        section_match = re.match(r'^##\s+(.+)', line)
        if section_match:
            current_section = section_match.group(1).strip()
            if current_error:
                errors.append(current_error)
                current_error = {}
            continue
        
        # 检测错误行（含"错误"、"根因"、"修复"关键字的列表项）
        error_match = re.match(r'^-\s*\*\*错误\*\*[：:]\s*(.+)', line)
        root_match = re.match(r'^-\s*\*\*根因\*\*[：:]\s*(.+)', line)
        fix_match = re.match(r'^-\s*\*\*修复\*\*[：:]\s*(.+)', line)
        fix2_match = re.match(r'^-\s*\*\*→\s*已沉淀\*\*\s*(.+)', line)
        table_error_match = re.match(r'^\|\s*\*\*错误\*\*\s*\|', line)
        
        if error_match:
            if current_error:
                errors.append(current_error)
            current_error = {
                "section": current_section or "未分类",
                "error": error_match.group(1),
                "root_cause": "",
                "fix": "",
                "precipitated": ""
            }
        elif root_match and current_error:
            current_error["root_cause"] = root_match.group(1)
        elif fix_match and current_error:
            current_error["fix"] = fix_match.group(1)
        elif fix2_match and current_error:
            current_error["precipitated"] = fix2_match.group(1)
    
    if current_error:
        errors.append(current_error)
    
    return errors

def parse_memory_rules(filepath):
    """从 MEMORY.md 提取规则"""
    rules = []
    current_section = None
    
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    for line in lines:
        line = line.rstrip()
        section_match = re.match(r'^##\s+(.+)', line)
        if section_match:
            current_section = section_match.group(1).strip()
            continue
        rule_match = re.match(r'^-\s*\*{0,2}(.+?)\*{0,2}\s*—\s*(.+)$', line)
        rule_match2 = re.match(r'^-\s*(.+)$', line)
        if rule_match:
            rules.append({"section": current_section, "rule": rule_match.group(1), "detail": rule_match.group(2)})
        elif rule_match2 and current_section:
            text = rule_match2.group(1).strip()
            if text and not text.startswith(">") and not text.startswith("---"):
                rules.append({"section": current_section, "rule": text, "detail": ""})
    
    return rules

def generate_report(days=7, output_file=None):
    """生成审计报告"""
    files = get_calibration_files(days)
    
    if not files:
        print(f"⚠️  最近 {days} 天内没有校准日志文件")
        return
    
    # 提取所有错误
    all_errors = []
    for filename, filepath in files:
        errors = parse_errors(filepath)
        for e in errors:
            e["source"] = filename
        all_errors.extend(errors)
    
    # 按章节分组统计
    section_stats = defaultdict(list)
    for e in all_errors:
        section_stats[e["section"]].append(e)
    
    # 按错误关键词统计频率
    keyword_counts = defaultdict(int)
    for e in all_errors:
        keywords = re.findall(r'[\u4e00-\u9fa5a-zA-Z]+', e["error"])
        for kw in keywords:
            if len(kw) >= 2:
                keyword_counts[kw] += 1
    
    # 重复错误（同一章节出现多次）
    repeated = {s: es for s, es in section_stats.items() if len(es) >= 2}
    
    # 读取 MEMORY.md 规则
    memory_rules = parse_memory_rules(MEMORY_FILE) if os.path.exists(MEMORY_FILE) else []
    
    # 构建报告
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    report_lines = [
        f"# 校准日志审计报告\n",
        f"> 生成时间：{now} | 扫描范围：最近 {days} 天 | 涉及文件：{len(files)} 个\n",
        f"---\n",
    ]
    
    # 概览
    report_lines.append("## 概览\n")
    report_lines.append(f"| 指标 | 数值 |")
    report_lines.append(f"|------|------|")
    report_lines.append(f"| 校准日志文件 | {len(files)} 个 |")
    report_lines.append(f"| 错误记录总数 | {len(all_errors)} 条 |")
    report_lines.append(f"| 涉及章节 | {len(section_stats)} 个 |")
    report_lines.append(f"| 重复错误类型 | {len(repeated)} 个 |")
    report_lines.append(f"| MEMORY.md 规则 | {len(memory_rules)} 条 |\n")
    
    # 重复错误分析
    if repeated:
        report_lines.append("## ⚠️ 高频重复错误\n")
        report_lines.append("以下错误在同一类型中出现了 2 次以上，建议重点修复：\n")
        for section, errors in sorted(repeated.items(), key=lambda x: -len(x[1])):
            report_lines.append(f"### {section}（{len(errors)} 次）\n")
            report_lines.append("| 日期 | 错误 | 根因 | 修复 |")
            report_lines.append("|------|------|------|------|")
            for e in errors:
                report_lines.append(f"| {e['source'].replace('.md','')} | {e['error'][:30]} | {e['root_cause'][:30]} | {e['fix'][:30]} |")
            report_lines.append("")
    
    # 按章节分布
    report_lines.append("## 错误分布\n")
    report_lines.append("| 章节 | 错误数 |")
    report_lines.append("|------|--------|")
    for section, errors in sorted(section_stats.items(), key=lambda x: -len(x[1])):
        report_lines.append(f"| {section} | {len(errors)} |")
    report_lines.append("")
    
    # MEMORY.md 规则审计
    if memory_rules:
        report_lines.append("## MEMORY.md 规则审计\n")
        report_lines.append(f"当前共 {len(memory_rules)} 条规则：\n")
        for r in memory_rules:
            report_lines.append(f"- **{r['section']}**：{r['rule']}")
        report_lines.append("")
        report_lines.append("> 提示：检查是否有规则对应的脚本/文件已修复，不再需要此规则。\n")
    
    # 最近日志摘要
    report_lines.append("## 最近校准日志\n")
    for filename, filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        errors_in_file = [e for e in all_errors if e["source"] == filename]
        report_lines.append(f"- **{filename}**：{len(errors_in_file)} 条错误记录")
    report_lines.append("")
    
    report = "\n".join(report_lines)
    
    if output_file:
        output_path = os.path.join(MEMORY_DIR, output_file)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"✅ 报告已生成：{output_path}")
    else:
        print(report)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="校准日志审计工具")
    parser.add_argument("--days", type=int, default=7, help="扫描最近 N 天的日志（默认 7）")
    parser.add_argument("--output", help="输出到指定文件（不指定则打印到终端）")
    args = parser.parse_args()
    
    generate_report(days=args.days, output_file=args.output)

if __name__ == "__main__":
    main()

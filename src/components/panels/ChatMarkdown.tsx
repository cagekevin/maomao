/**
 * ChatMarkdown —— AI 助手消息的受限 Markdown 渲染（照猫猫二 ChatMarkdown 思路，适配 maomao TS 体系）。
 *
 * 支持：
 *  - 块级：标题(#/##/###)、有序/无序列表、表格、代码块（带复制按钮）、引用、分隔线、段落
 *  - 行内：加粗(**)、斜体(*)、删除线(~~)、行内代码(`)、安全链接([text](url))、@节点/@model/@skill 引用
 *  - 图片：markdown 图片 ![]() / <img> / 裸图片 URL（复用 markdownImages 判定），点击放大
 *
 * 安全约束：
 *  - 链接仅放行 http(s): / mailto:，其余显示为纯文本，杜绝 javascript: 等注入。
 *  - 不引入 react-markdown，纯函数式轻量解析，零运行时依赖、可控、无 XSS 面。
 */
import { memo, useState } from 'react'
import type { ReactNode } from 'react'
import LazyImage from '../base/ui/LazyImage.tsx'
import { extractImageSpans, isImageUrl, type ImageSpan } from './markdownImages.ts'

/** 行内匹配模式（含 markdown 图片，由外层切图先处理） */
const INLINE_PATTERN = /(@\{[^:}\r\n]+:[^}\r\n]+\}|@model\{[^|}\r\n]+\|[^}\r\n]*\}|@skill\{[^|}\r\n]+\|[^}\r\n]*\}|`[^`\r\n]+`|\[[^\]\r\n]+\]\([^)\s]+\)|\*\*[^*\r\n]+\*\*|~~[^~\r\n]+~~|\*[^*\r\n]+\*)/g

interface ChatMarkdownProps {
  value: string
  /** 点击图片放大（复用 AgentMessage 的原生 dialog 查看大图） */
  onOpenImage?: (url: string) => void
}

function resolveSafeHref(value: string): string | null {
  const href = value.trim()
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href
  return null
}

/** 行内内容解析器：渲染加粗/斜体/删除线/行内代码/链接/@引用。value 已由外层切掉图片段。 */
function InlineContent({ value }: { value: string }) {
  const nodes: ReactNode[] = []
  let cursor = 0

  for (const match of value.matchAll(INLINE_PATTERN)) {
    const raw = match[0]
    const start = match.index
    if (start == null) continue
    if (start > cursor) {
      nodes.push(<span key={`text-${cursor}`}>{value.slice(cursor, start)}</span>)
    }

    if (raw.startsWith('@')) {
      // @节点 / @model / @skill 引用：高亮为胶囊样式（maomao 无 ChatReferenceText，用样式区分）
      nodes.push(
        <span key={`ref-${start}`} className="inline-flex items-center rounded bg-surface-hover px-1 py-px font-mono text-caption-sm text-blue-300">
          {raw}
        </span>,
      )
    } else if (raw.startsWith('`')) {
      nodes.push(
        <code key={`code-${start}`} className="rounded bg-surface-hover px-1 py-0.5 font-mono text-[0.9em] text-body">
          {raw.slice(1, -1)}
        </code>,
      )
    } else if (raw.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw)
      const href = linkMatch ? resolveSafeHref(linkMatch[2]) : null
      nodes.push(href ? (
        <a
          key={`link-${start}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-300 underline decoration-blue-300/35 underline-offset-2 hover:text-blue-200 hover:decoration-blue-200/70"
        >
          {linkMatch?.[1]}
        </a>
      ) : (
        <span key={`unsafe-link-${start}`}>{linkMatch?.[1] ?? raw}</span>
      ))
    } else if (raw.startsWith('**')) {
      nodes.push(
        <strong key={`strong-${start}`} className="font-semibold text-primary">
          <InlineContent value={raw.slice(2, -2)} />
        </strong>,
      )
    } else if (raw.startsWith('~~')) {
      nodes.push(
        <del key={`del-${start}`} className="text-muted">
          <InlineContent value={raw.slice(2, -2)} />
        </del>,
      )
    } else {
      nodes.push(
        <em key={`em-${start}`} className="italic text-secondary">
          <InlineContent value={raw.slice(1, -1)} />
        </em>,
      )
    }
    cursor = start + raw.length
  }

  if (cursor < value.length) {
    nodes.push(<span key={`text-${cursor}`}>{value.slice(cursor)}</span>)
  }
  return <>{nodes}</>
}

/**
 * 行内图片渲染：在给定的行内文本里抽取图片段，图片渲染成 <LazyImage>（点击放大），
 * 其余文本交给 InlineContent 做行内 markdown 解析。
 */
function InlineWithImages({ value, onOpenImage }: { value: string; onOpenImage?: (url: string) => void }) {
  const spans = extractImageSpans(value)
  if (spans.length === 0) return <InlineContent value={value} />
  const nodes: ReactNode[] = []
  let last = 0
  spans.forEach((s: ImageSpan, i) => {
    if (s.start > last) nodes.push(<InlineContent key={`t${i}`} value={value.slice(last, s.start)} />)
    nodes.push(
      <button
        key={`i${i}`}
        type="button"
        onClick={() => onOpenImage?.(s.url)}
        className="my-1 block w-full max-w-[280px] overflow-hidden rounded-md border border-white/15 p-0 text-left transition-colors hover:border-white/40 cursor-zoom-in"
        title="点击查看大图"
      >
        <LazyImage src={s.url} alt="" className="w-full bg-black/30" imgClassName="w-full h-auto max-h-[240px] object-contain" />
      </button>,
    )
    last = s.end
  })
  if (last < value.length) nodes.push(<InlineContent key={`t${spans.length}`} value={value.slice(last)} />)
  return <>{nodes}</>
}

/** 代码块（带复制按钮） */
const CodeBlock = memo(function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="group/code relative my-2 overflow-hidden rounded-lg border border-edge bg-code-bg">
      <div className="flex h-8 items-center justify-between border-b border-edge px-2.5 text-caption text-muted">
        <span className="font-medium uppercase">{language || 'code'}</span>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-body"
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-body-xs leading-5 text-secondary">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
})

/** 表格行拆分：去首尾 | 后按 | 切分并 trim */
function splitTableRow(value: string): string[] {
  return value.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

/** 是否为表格分隔行（如 | --- | :--: |） */
function isTableDivider(value: string): boolean {
  const cells = splitTableRow(value)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

/** 判断该行是否开启一个新块（段落结束边界） */
function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? ''
  if (!line.trim()) return true
  if (/^```/.test(line) || /^#{1,6}\s+/.test(line) || /^>\s?/.test(line)) return true
  if (/^\s*(?:[-+*]|\d+\.)\s+/.test(line) || /^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) return true
  return index + 1 < lines.length && line.includes('|') && isTableDivider(lines[index + 1])
}

function ChatMarkdown({ value, onOpenImage }: ChatMarkdownProps) {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = /^```([^\s`]*)\s*$/.exec(line)
    if (fence) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(<CodeBlock key={`code-${index}`} code={code.join('\n')} language={fence[1]} />)
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const headingClasses = level === 1
        ? 'mt-3 mb-1.5 text-[15px] font-semibold'
        : level === 2
          ? 'mt-3 mb-1 text-[14px] font-semibold'
          : 'mt-2.5 mb-1 text-[13px] font-semibold'
      const content = <InlineWithImages value={heading[2]} onOpenImage={onOpenImage} />
      if (level === 1) blocks.push(<h1 key={`h-${index}`} className={headingClasses}>{content}</h1>)
      else if (level === 2) blocks.push(<h2 key={`h-${index}`} className={headingClasses}>{content}</h2>)
      else blocks.push(<h3 key={`h-${index}`} className={headingClasses}>{content}</h3>)
      index += 1
      continue
    }

    if (/^\s*(?:-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={`hr-${index}`} className="my-3 border-edge" />)
      index += 1
      continue
    }

    if (index + 1 < lines.length && line.includes('|') && isTableDivider(lines[index + 1])) {
      const header = splitTableRow(line)
      const rows: string[][] = []
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      blocks.push(
        <div key={`table-${index}`} className="my-2 overflow-x-auto rounded-lg border border-edge">
          <table className="w-full min-w-[280px] border-collapse text-left text-body-xs">
            <thead className="bg-surface-hover text-secondary">
              <tr>{header.map((cell, cellIndex) => (
                <th key={cellIndex} className="border-b border-edge px-2.5 py-2 font-medium">
                  <InlineWithImages value={cell} onOpenImage={onOpenImage} />
                </th>
              ))}</tr>
            </thead>
            <tbody>{rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-edge/60 last:border-b-0">
                {header.map((_, cellIndex) => (
                  <td key={cellIndex} className="px-2.5 py-2 align-top text-body/90">
                    <InlineWithImages value={row[cellIndex] ?? ''} onOpenImage={onOpenImage} />
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>,
      )
      continue
    }

    const listItem = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(line)
    if (listItem) {
      const ordered = /\d+\./.test(listItem[1])
      const items: string[] = []
      while (index < lines.length) {
        const item = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(lines[index])
        if (!item || /\d+\./.test(item[1]) !== ordered) break
        items.push(item[2])
        index += 1
      }
      const children = items.map((item, itemIndex) => (
        <li key={itemIndex} className="pl-0.5 marker:text-muted">
          <InlineWithImages value={item} onOpenImage={onOpenImage} />
        </li>
      ))
      blocks.push(ordered ? (
        <ol key={`list-${index}`} className="my-1.5 list-decimal space-y-1 pl-5 text-body/90">{children}</ol>
      ) : (
        <ul key={`list-${index}`} className="my-1.5 list-disc space-y-1 pl-5 text-body/90">{children}</ul>
      ))
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(
        <blockquote key={`quote-${index}`} className="my-2 border-l-2 border-edge pl-3 text-muted">
          {quote.map((quoteLine, quoteIndex) => (
            <span key={quoteIndex} className="block">
              <InlineWithImages value={quoteLine} onOpenImage={onOpenImage} />
            </span>
          ))}
        </blockquote>,
      )
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(
      <p key={`p-${index}`} className="my-1.5 text-body/90 first:mt-0 last:mb-0">
        {paragraph.map((paragraphLine, lineIndex) => (
          <span key={lineIndex}>
            {lineIndex > 0 && <br />}
            <InlineWithImages value={paragraphLine} onOpenImage={onOpenImage} />
          </span>
        ))}
      </p>,
    )
  }

  return <div className="min-w-0 [overflow-wrap:anywhere]">{blocks}</div>
}

export default memo(ChatMarkdown)

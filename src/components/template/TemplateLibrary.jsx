// 模板库 UI 组件
// 替代 App.js 中的 sg (模板库面板) 和 og (角标)
// 设计风格与 PromptLibrary 保持一致：两栏布局 + 自包含 CSS
import { i as e } from "../../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor/vendor.js";
import {
  getTemplates,
  getPublicTemplates,
  togglePublic,
  deleteTemplate,
  CATEGORY_OPTIONS
} from "../../services/templateManager.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();

const TEMPLATE_MIME = 'application/x-maomao-template';

/* ========== 自包含 CSS (tl- 前缀) ========== */
const STYLES = `
.tl-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 9999; }
.tl-modal { width: 88vw; height: 84vh; max-width: 1400px; background: #141414; border: 1px solid #2a2a2a; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; position: relative; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; }
.tl-header { height: 60px; border-bottom: 1px solid #222; display: flex; align-items: center; padding: 0 20px; gap: 16px; flex-shrink: 0; }
.tl-brand { display: flex; align-items: center; gap: 8px; padding-right: 16px; border-right: 1px solid #2a2a2a; }
.tl-brand span { font-size: 16px; font-weight: 600; color: #fff; white-space: nowrap; }
.tl-search { position: relative; flex: 1; max-width: 320px; }
.tl-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666; width: 16px; height: 16px; }
.tl-search input { width: 100%; height: 34px; background: #1a1a1a; border: 1px solid #333; border-radius: 10px; padding: 0 12px 0 34px; color: #e5e5e5; font-size: 13px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.tl-search input:focus { border-color: #555; }
.tl-search input::placeholder { color: #666; }
.tl-close { margin-left: auto; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 8px; color: #888; cursor: pointer; }
.tl-close:hover { background: #2a2a2a; color: #fff; }
.tl-body { display: flex; flex: 1; overflow: hidden; }

/* 左侧导航 */
.tl-sidebar { width: 170px; border-right: 1px solid #222; padding: 16px 12px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.tl-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; color: #999; cursor: pointer; transition: all 0.15s; border: none; background: transparent; width: 100%; text-align: left; }
.tl-nav-item:hover { background: #1f1f1f; color: #ddd; }
.tl-nav-item.active { background: #1f1f1f; color: #fff; font-weight: 500; }

/* 主区域 */
.tl-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.tl-toolbar { height: 58px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
.tl-filters { display: flex; gap: 8px; align-items: center; }
.tl-filter { padding: 7px 14px; border-radius: 999px; font-size: 12px; background: #1f1f1f; color: #999; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; }
.tl-filter:hover { background: #2a2a2a; color: #ddd; }
.tl-filter.active { background: #fff; color: #141414; font-weight: 500; }
.tl-content { flex: 1; overflow-y: auto; padding: 4px 20px 24px; }
.tl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.tl-empty { height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 14px; }

/* 模板卡片 */
.tl-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; overflow: hidden; cursor: pointer; transition: all 0.15s; position: relative; display: flex; flex-direction: column; }
.tl-card:hover { border-color: #444; background: #1f1f1f; }
.tl-card-cover { position: relative; aspect-ratio: 3/2; background: #0d0c0c; overflow: hidden; flex-shrink: 0; }
.tl-card-cover img { width: 100%; height: 100%; object-fit: cover; }
.tl-card-cover-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 36px; color: #333; }
.tl-card-delete { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: rgba(0,0,0,0.5); border: none; color: #888; cursor: pointer; opacity: 0; transition: all 0.15s; }
.tl-card:hover .tl-card-delete { opacity: 1; }
.tl-card-delete:hover { background: rgba(239,68,68,0.6); color: #fff; }
.tl-card-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.tl-card-name { font-size: 13px; font-weight: 500; color: #e5e5e5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }
.tl-card-meta { display: flex; align-items: center; gap: 6px; }
.tl-tag { padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 500; }
.tl-tag.image { background: rgba(59,130,246,0.12); color: #60a5fa; }
.tl-tag.video { background: rgba(168,85,247,0.12); color: #c084fc; }
.tl-tag.text { background: rgba(34,197,94,0.12); color: #4ade80; }
.tl-node-count { font-size: 11px; color: #666; }
.tl-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: auto; }
.tl-use-btn { padding: 5px 14px; border-radius: 8px; font-size: 12px; background: transparent; color: #60a5fa; border: 1px solid #333; cursor: pointer; transition: all 0.15s; }
.tl-use-btn:hover { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.3); }

/* Toast */
.tl-toast { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10001; padding: 8px 16px; border-radius: 8px; background: #2a2a2a; border: 1px solid #3a3a3a; font-size: 13px; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }

/* 滚动条 */
.tl-custom-scrollbar::-webkit-scrollbar { width: 6px; }
.tl-custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.tl-custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
`;

/* ========== 内联 SVG 图标 ========== */

var TemplateIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 18, height: 18, fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
  children: X.jsxs("g", {
    children: [
      X.jsx("rect", { x: 3, y: 3, width: 14, height: 14, rx: 2 }),
      X.jsx("line", { x1: 3, y1: 9, x2: 17, y2: 9 }),
      X.jsx("line", { x1: 9, y1: 9, x2: 9, y2: 17 })
    ]
  })
});

var CloseIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 18, height: 18, fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
  children: X.jsxs("g", {
    children: [
      X.jsx("line", { x1: 5, y1: 5, x2: 15, y2: 15 }),
      X.jsx("line", { x1: 15, y1: 5, x2: 5, y2: 15 })
    ]
  })
});

var SearchIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
  children: X.jsxs("g", {
    children: [
      X.jsx("circle", { cx: 8.5, cy: 8.5, r: 6 }),
      X.jsx("line", { x1: 13.5, y1: 13.5, x2: 18, y2: 18 })
    ]
  })
});

function TrashIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 14, height: 14, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsxs("g", {
      children: [
        X.jsx("line", { x1: 5, y1: 6, x2: 15, y2: 6 }),
        X.jsx("path", { d: "M7.5 6V4.5a1 1 0 011-1h3a1 1 0 011 1V6M14 6l-.5 10.5a1 1 0 01-1 .9h-5a1 1 0 01-1-.9L6 6" })
      ]
    })
  });
}

function ListIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsxs("g", {
      children: [
        X.jsx("path", { d: "M3 6h14M3 10h14M3 14h10" })
      ]
    })
  });
}

/* ========== 工具 ========== */

function categoryLabel(cat) {
  return { image: '图片', video: '视频', text: '文本' }[cat] || '图片';
}

function categoryTagClass(cat) {
  return 'tl-tag ' + ({ image: 'image', video: 'video', text: 'text' }[cat] || 'image');
}

function resolveCoverUrl(url) {
  if (!url) return '';
  // 本地模式：直接返回，localTool 不支持 tos-process 参数
  return url;
}

/* ========== TemplateLibrary 弹窗 ========== */

function TemplateLibrary({
  open,
  onClose,
  onUse,
  onToast
}) {
  var _tab = Y.useState('mine'), activeTab = _tab[0], setActiveTab = _tab[1];
  var _search = Y.useState(''), searchKeyword = _search[0], setSearchKeyword = _search[1];
  var _cat = Y.useState(''), selectedCategory = _cat[0], setSelectedCategory = _cat[1];
  var _toast = Y.useState(''), toast = _toast[0], setToast = _toast[1];
  var _loading = Y.useState(false), loading = _loading[0], setLoading = _loading[1];
  var _templates = Y.useState([]), templates = _templates[0], setTemplates = _templates[1];

  // 重置状态
  Y.useEffect(function () {
    if (open) {
      setActiveTab('mine');
      setSearchKeyword('');
      setSelectedCategory('');
      loadTemplates();
    }
  }, [open]);

  var showToast = function (msg) {
    if (onToast) onToast(msg);
    setToast(msg);
    setTimeout(function () { setToast(''); }, 2000);
  };

  var loadTemplates = async function () {
    setLoading(true);
    try {
      var fn = activeTab === 'mine' ? getTemplates : getPublicTemplates;
      var data = await fn({ category: selectedCategory, keyword: searchKeyword });
      setTemplates(data);
    } catch (_) {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // 分类或 tab 变化时重新加载
  Y.useEffect(function () {
    if (open) loadTemplates();
  }, [activeTab, selectedCategory]);

  // 前端搜索（实时过滤）
  var displayTemplates = Y.useMemo(function () {
    if (!searchKeyword.trim()) return templates;
    var kw = searchKeyword.trim().toLowerCase();
    return templates.filter(function (t) { return (t.name || '').toLowerCase().includes(kw); });
  }, [templates, searchKeyword]);

  var handleDelete = async function (tpl, evt) {
    evt.stopPropagation();
    var ok = await deleteTemplate(tpl.id);
    if (ok) {
      setTemplates(function (arr) { return arr.filter(function (t) { return t.id !== tpl.id; }); });
      showToast('已删除');
    } else {
      showToast('删除失败');
    }
  };

  var handleUse = function (tpl) {
    if (onUse) {
      onUse(tpl);
      onClose();
    }
  };

  var handleDragStart = function (evt, tpl) {
    var payload = JSON.stringify(tpl);
    evt.dataTransfer.setData(TEMPLATE_MIME, payload);
    evt.dataTransfer.setData('text/plain', payload);
    evt.dataTransfer.effectAllowed = 'copy';
  };

  if (!open) return null;

  return Un.createPortal(X.jsxs("div", {
    className: "tl-overlay nowheel nopan nodrag",
    onClick: onClose,
    children: [
      X.jsx("style", { children: STYLES }),

      // 主弹窗
      X.jsxs("div", {
        className: "tl-modal",
        onClick: function (evt) { evt.stopPropagation(); },
        children: [
          // Toast
          toast && X.jsx("div", {
            className: "tl-toast",
            children: toast
          }),

          // Header
          X.jsxs("div", {
            className: "tl-header",
            children: [
              X.jsxs("div", {
                className: "tl-brand",
                children: [
                  TemplateIcon,
                  X.jsx("span", { children: "模板库" })
                ]
              }),
              X.jsxs("div", {
                className: "tl-search",
                children: [
                  SearchIcon,
                  X.jsx("input", {
                    value: searchKeyword,
                    onChange: function (e) { setSearchKeyword(e.target.value); },
                    placeholder: "搜索模板名称"
                  })
                ]
              }),
              X.jsx("button", {
                onClick: onClose,
                className: "tl-close",
                children: CloseIcon
              })
            ]
          }),

          // Body
          X.jsxs("div", {
            className: "tl-body",
            children: [
              // 左侧导航
              X.jsxs("div", {
                className: "tl-sidebar",
                children: [
                  X.jsxs("button", {
                    onClick: function () { setActiveTab('mine'); },
                    className: "tl-nav-item " + (activeTab === 'mine' ? 'active' : ''),
                    children: [ListIcon(), "我的模板"]
                  })
                ]
              }),

              // 主区域
              X.jsxs("div", {
                className: "tl-main",
                children: [
                  // 工具栏：分类筛选
                  X.jsx("div", {
                    className: "tl-toolbar",
                    children: [
                      X.jsx("div", {
                        className: "tl-filters",
                        children: CATEGORY_OPTIONS.map(function (opt) {
                          var isActive = selectedCategory === opt.value;
                          return X.jsx("button", {
                            onClick: function () { setSelectedCategory(opt.value); },
                            className: "tl-filter " + (isActive ? 'active' : ''),
                            children: opt.label
                          }, opt.value || 'all');
                        })
                      })
                    ]
                  }),

                  // 卡片网格
                  X.jsx("div", {
                    className: "tl-content tl-custom-scrollbar",
                    children: loading ? X.jsx("div", {
                      className: "tl-empty",
                      children: "加载中..."
                    }) : displayTemplates.length === 0 ? X.jsx("div", {
                      className: "tl-empty",
                      children: "还没有创建模板，框选画布节点即可创建"
                    }) : X.jsx("div", {
                      className: "tl-grid",
                      children: displayTemplates.map(function (tpl) {
                        return X.jsxs("div", {
                          key: tpl.id,
                          className: "tl-card",
                          draggable: true,
                          onDragStart: function (evt) { handleDragStart(evt, tpl); },
                          title: "拖拽到画布插入，或点击使用",
                          onClick: function () { handleUse(tpl); },
                          children: [
                            // 封面
                            X.jsx("div", {
                              className: "tl-card-cover",
                              children: tpl.coverUrl ? X.jsx("img", {
                                src: resolveCoverUrl(tpl.coverUrl),
                                alt: tpl.name,
                                draggable: false
                              }) : X.jsx("div", {
                                className: "tl-card-cover-fallback",
                                children: tpl.category === 'video' ? '🎬' : tpl.category === 'text' ? '📝' : '🖼️'
                              })
                            }),
                            // 删除按钮
                            X.jsx("button", {
                              onClick: function (evt) { handleDelete(tpl, evt); },
                              className: "tl-card-delete",
                              title: "删除",
                              children: TrashIcon()
                            }),
                            // 信息区
                            X.jsxs("div", {
                              className: "tl-card-body",
                              children: [
                                X.jsx("div", {
                                  className: "tl-card-name",
                                  title: tpl.name,
                                  children: tpl.name || '(未命名)'
                                }),
                                X.jsxs("div", {
                                  className: "tl-card-meta",
                                  children: [
                                    X.jsx("span", {
                                      className: categoryTagClass(tpl.category),
                                      children: categoryLabel(tpl.category)
                                    }),
                                    tpl.nodeCount > 0 && X.jsx("span", {
                                      className: "tl-node-count",
                                      children: tpl.nodeCount + '个节点'
                                    })
                                  ]
                                }),
                                X.jsxs("div", {
                                  className: "tl-card-bottom",
                                  children: [
                                    X.jsx("div"),
                                    X.jsx("button", {
                                      onClick: function (evt) { evt.stopPropagation(); handleUse(tpl); },
                                      className: "tl-use-btn",
                                      children: "使用"
                                    })
                                  ]
                                })
                              ]
                            })
                          ]
                        });
                      })
                    })
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  }), document.body);
}

export { TemplateLibrary };

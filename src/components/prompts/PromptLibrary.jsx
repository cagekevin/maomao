// 提示词管理 UI 组件
// 替代 App.js 中的 qa (弹窗 ~2059) 和 Ja (下拉 ~2278)，纯本地模式
import { i as e } from "../../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor/vendor.js";
import { Ua } from "../../config/options.js";
import {
  mapToLibraryCards,
  getRecent,
  recordRecent,
  getRecentCards,
  searchCards,
  saveAndNotify
} from "../../services/promptManager.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();

/* ========== 内置独立 CSS 样式 ========== */
const injectedStyles = `
/* 弹窗通用基础样式 */
.pl-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 9999; }
.pl-modal { width: 88vw; height: 84vh; max-width: 1400px; background: #141414; border: 1px solid #2a2a2a; border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; position: relative; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; }
.pl-header { height: 60px; border-bottom: 1px solid #222; display: flex; align-items: center; padding: 0 20px; gap: 16px; flex-shrink: 0; }
.pl-brand { display: flex; align-items: center; gap: 8px; padding-right: 16px; border-right: 1px solid #2a2a2a; }
.pl-brand svg { color: #fff; }
.pl-brand span { font-size: 16px; font-weight: 600; color: #fff; white-space: nowrap; }
.pl-search { position: relative; flex: 1; max-width: 320px; }
.pl-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #666; width: 16px; height: 16px; }
.pl-search input { width: 100%; height: 34px; background: #1a1a1a; border: 1px solid #333; border-radius: 10px; padding: 0 12px 0 34px; color: #e5e5e5; font-size: 13px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.pl-search input:focus { border-color: #555; }
.pl-search input::placeholder { color: #666; }
.pl-close { margin-left: auto; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 8px; color: #888; cursor: pointer; }
.pl-close:hover { background: #2a2a2a; color: #fff; }
.pl-body { display: flex; flex: 1; overflow: hidden; }

/* 左侧导航 */
.pl-sidebar { width: 170px; border-right: 1px solid #222; padding: 16px 12px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.pl-nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; color: #999; cursor: pointer; transition: all 0.15s; border: none; background: transparent; width: 100%; text-align: left; }
.pl-nav-item:hover { background: #1f1f1f; color: #ddd; }
.pl-nav-item.active { background: #1f1f1f; color: #fff; font-weight: 500; }

/* 主体区域 */
.pl-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.pl-toolbar { height: 58px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
.pl-filters { display: flex; gap: 8px; align-items: center; }
.pl-filter { padding: 7px 14px; border-radius: 999px; font-size: 12px; background: #1f1f1f; color: #999; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; }
.pl-filter:hover { background: #2a2a2a; color: #ddd; }
.pl-filter.active { background: #fff; color: #141414; font-weight: 500; }
.pl-btn-primary { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 14px; border-radius: 10px; font-size: 12px; background: #2563eb; color: #fff; border: none; cursor: pointer; transition: background 0.15s; }
.pl-btn-primary:hover { background: #3b82f6; }
.pl-content { flex: 1; overflow-y: auto; padding: 4px 20px 24px; }
.pl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

/* 提示词卡片 */
.pl-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; transition: all 0.15s; position: relative; }
.pl-card:hover { border-color: #444; background: #1f1f1f; }
.pl-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.pl-card-title { font-size: 14px; font-weight: 600; color: #fff; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.pl-card-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.pl-card:hover .pl-card-actions { opacity: 1; }
.pl-icon-btn { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: transparent; border: none; color: #888; cursor: pointer; }
.pl-icon-btn:hover { background: #2a2a2a; color: #fff; }
.pl-icon-btn.danger:hover { background: rgba(239,68,68,0.12); color: #ef4444; }
.pl-card-body { font-size: 12px; color: #888; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; margin: 0; }
.pl-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.pl-tag { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; }
.pl-tag.text { background: rgba(34,197,94,0.12); color: #4ade80; }
.pl-tag.image { background: rgba(59,130,246,0.12); color: #60a5fa; }
.pl-tag.video { background: rgba(168,85,247,0.12); color: #c084fc; }
.pl-tag.all { background: rgba(255,255,255,0.08); color: #aaa; }
.pl-use-btn { padding: 5px 12px; border-radius: 8px; font-size: 12px; background: transparent; color: #60a5fa; border: 1px solid #333; cursor: pointer; transition: all 0.15s; }
.pl-use-btn:hover { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.3); }
.pl-empty { height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 14px; }

/* 编辑/新建 弹窗 */
.pl-edit-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.pl-edit-modal { width: 520px; background: #1a1a1a; border: 1px solid #333; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); font-family: sans-serif; }
.pl-edit-modal h3 { font-size: 15px; font-weight: 600; color: #fff; margin: 0; }
.pl-field { display: flex; flex-direction: column; gap: 6px; }
.pl-field-row { display: flex; gap: 10px; }
.pl-field label { font-size: 12px; color: #888; margin: 0; }
.pl-field input, .pl-field select, .pl-field textarea { background: #141414; border: 1px solid #333; border-radius: 10px; padding: 10px 12px; color: #e5e5e5; font-size: 13px; outline: none; box-sizing: border-box; }
.pl-field input:focus, .pl-field select:focus, .pl-field textarea:focus { border-color: #555; }
.pl-field textarea { resize: none; height: 160px; line-height: 1.6; }
.pl-edit-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
.pl-btn-danger { padding: 8px 14px; border-radius: 10px; font-size: 12px; background: transparent; color: #ef4444; border: none; cursor: pointer; }
.pl-btn-danger:hover { background: rgba(239,68,68,0.12); }
.pl-btn-group { display: flex; gap: 10px; }
.pl-btn-secondary { padding: 8px 16px; border-radius: 10px; font-size: 12px; background: #2a2a2a; color: #ccc; border: none; cursor: pointer; }
.pl-btn-secondary:hover { background: #333; }

/* Toast */
.pl-toast { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10001; padding: 8px 16px; border-radius: 8px; background: #2a2a2a; border: 1px solid #3a3a3a; font-size: 13px; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }

/* 下拉菜单 (Dropdown) */
.pd-container { position: relative; display: flex; align-items: center; font-family: sans-serif; }
.pd-divider { width: 1px; height: 12px; background: #444; flex-shrink: 0; margin-right: 6px; }
.pd-trigger { display: flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; background: transparent; border: 1px solid transparent; border-radius: 4px; font-size: 11px; color: #ccc; cursor: pointer; transition: all 0.15s; max-width: 80px; }
.pd-trigger:hover { background: #2a2a2a; border-color: #333; }
.pd-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-popup { position: absolute; bottom: 100%; left: 0; margin-bottom: 4px; width: 224px; background: #222; border: 1px solid #333; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 9999; display: flex; flex-direction: column; max-height: 320px; overflow: hidden; }
.pd-search-wrap { flex-shrink: 0; padding: 8px 8px 4px 8px; }
.pd-search-input { width: 100%; font-size: 11px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 4px 8px; color: #ccc; outline: none; box-sizing: border-box; }
.pd-search-input:focus { border-color: #3b82f6; }
.pd-list { flex: 1; overflow-y: auto; padding: 4px 8px 8px 8px; }
.pd-item { width: 100%; display: block; margin-bottom: 4px; text-align: left; padding: 6px 8px; font-size: 11px; border-radius: 6px; transition: all 0.15s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #aaa; background: transparent; border: none; cursor: pointer; box-sizing: border-box; }
.pd-item:hover { background: #2a2a2a; color: #eee; }
.pd-empty { padding: 6px 8px; font-size: 11px; color: #666; text-align: center; }
.pd-footer { flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 6px 8px; border-top: 1px solid #333; }
.pd-footer-btn { display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; font-size: 10px; color: #60a5fa; background: transparent; border: none; cursor: pointer; transition: color 0.15s; padding: 4px 0; }
.pd-footer-btn:hover { color: #93c5fd; }

/* 滚动条美化 */
.pl-custom-scrollbar::-webkit-scrollbar { width: 6px; }
.pl-custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
.pl-custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
`;

/* ========== 内联 SVG 图标 ========== */

var SparklesIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 18, height: 18, fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  children: X.jsx("path", {
    d: "M10 1.5l1.2 4.3 4.3 1.2-4.3 1.2L10 18.5l-1.2-4.3-4.3-1.2 4.3-1.2L10 1.5z"
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

function SearchIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsx("circle", { cx: 8.5, cy: 8.5, r: 6 })
  });
}

function PlusIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 14, height: 14, fill: "none",
    stroke: "currentColor", strokeWidth: 2,
    children: X.jsxs("g", {
      children: [
        X.jsx("line", { x1: 10, y1: 3, x2: 10, y2: 17 }),
        X.jsx("line", { x1: 3, y1: 10, x2: 17, y2: 10 })
      ]
    })
  });
}

function CheckIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 15, height: 15, fill: "none",
    stroke: "currentColor", strokeWidth: 2,
    children: X.jsx("polyline", { points: "4 10 8 14 16 6" })
  });
}

function EditIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 14, height: 14, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsx("path", {
      d: "M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z"
    })
  });
}

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

function ClockIcon() {
  return X.jsx("svg", {
    viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
    stroke: "currentColor", strokeWidth: 1.5,
    children: X.jsxs("g", {
      children: [
        X.jsx("polyline", { points: "4 10 8 14 16 6" })
      ]
    })
  });
}

var SearchFullIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 16, height: 16, fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
  children: X.jsxs("g", {
    children: [
      X.jsx("circle", { cx: 8.5, cy: 8.5, r: 6 }),
      X.jsx("line", { x1: 13.5, y1: 13.5, x2: 18, y2: 18 })
    ]
  })
});

/* ========== 工具 ========== */

function typeLabel(cat) {
  return { text: "文本", image: "生图", video: "视频" }[cat] || "通用";
}

function typeTagColor(cat) {
  return "pl-tag " + ({ text: "text", image: "image", video: "video" }[cat] || "all");
}

/* ========== PromptLibrary 弹窗 ========== */

function PromptLibrary({
  open,
  onClose,
  onUse,
  onToast,
  defaultCategory = "",
  presetPrompts = []
}) {
  var _a = Y.useState("mine"), activeTab = _a[0], setActiveTab = _a[1];
  var _b = Y.useState(""), searchKeyword = _b[0], setSearchKeyword = _b[1];
  var _c = Y.useState(defaultCategory), selectedCategory = _c[0], setSelectedCategory = _c[1];
  var _d = Y.useState(""), toast = _d[0], setToast = _d[1];
  var _f = Y.useState(-1), editingIndex = _f[0], setEditingIndex = _f[1];
  var _g = Y.useState(false), showNewForm = _g[0], setShowNewForm = _g[1];
  var _h = Y.useState({ title: "", type: "all", prompt: "" }), formData = _h[0], setFormData = _h[1];

  // 重置状态
  Y.useEffect(function () {
    if (open) {
      setSelectedCategory(defaultCategory);
      setSearchKeyword("");
      setActiveTab("mine");
      setEditingIndex(-1);
      setShowNewForm(false);
    }
  }, [open]);

  var showToast = function (msg) {
    if (onToast) onToast(msg);
    setToast(msg);
    setTimeout(function () { setToast(""); }, 2000);
  };

  var localCards = Y.useMemo(function () {
    return mapToLibraryCards(presetPrompts);
  }, [presetPrompts]);

  var recentIds = Y.useMemo(function () {
    return getRecent();
  }, [open]);

  var recentCards = Y.useMemo(function () {
    return getRecentCards(localCards, recentIds);
  }, [localCards, recentIds]);

  var displayCards = Y.useMemo(function () {
    var cards = activeTab === "recent" ? recentCards : localCards;
    if (selectedCategory) {
      cards = cards.filter(function (c) { return c.category === selectedCategory; });
    }
    cards = searchCards(cards, searchKeyword);
    return cards;
  }, [activeTab, recentCards, localCards, selectedCategory, searchKeyword]);

  var handleUse = function (card) {
    recordRecent(card.id);
    if (onUse) {
      onUse(card.content);
      onClose();
    } else {
      showToast("已复制到剪贴板");
      try { navigator.clipboard.writeText(card.content); } catch (e) {}
    }
  };

  var startEdit = function (presetIndex) {
    var preset = presetPrompts[presetIndex];
    if (!preset) return;
    setEditingIndex(presetIndex);
    setFormData({
      title: preset.title || "",
      type: preset.type || "all",
      prompt: preset.prompt || ""
    });
  };

  var saveEdit = function () {
    if (!formData.title.trim()) { showToast("请输入标题"); return; }
    var newPresets = presetPrompts.slice();
    newPresets[editingIndex] = {
      title: formData.title,
      type: formData.type,
      prompt: formData.prompt,
      enabled: newPresets[editingIndex].enabled !== false
    };
    saveAndNotify(newPresets);
    setEditingIndex(-1);
    showToast("已保存");
  };

  var handleDelete = function (presetIndex) {
    var newPresets = presetPrompts.filter(function (_, i) { return i !== presetIndex; });
    saveAndNotify(newPresets);
    if (editingIndex === presetIndex) setEditingIndex(-1);
    showToast("已删除");
  };

  var startNew = function () {
    setShowNewForm(true);
    setFormData({ title: "", type: selectedCategory || "all", prompt: "" });
  };

  var saveNew = function () {
    if (!formData.title.trim()) { showToast("请输入标题"); return; }
    var newPresets = presetPrompts.slice();
    newPresets.push({
      title: formData.title,
      type: formData.type,
      prompt: formData.prompt,
      enabled: true
    });
    saveAndNotify(newPresets);
    setShowNewForm(false);
    setFormData({ title: "", type: "all", prompt: "" });
    showToast("已添加");
  };

  var closeModal = function () {
    setEditingIndex(-1);
    setShowNewForm(false);
  };

  var isModalOpen = editingIndex >= 0 || showNewForm;

  if (!open) return null;

  return Un.createPortal(X.jsxs("div", {
    className: "pl-overlay nowheel nopan nodrag",
    onClick: onClose,
    children: [
      // 注入独立 CSS 样式
      X.jsx("style", { children: injectedStyles }),
      // 主弹窗
      X.jsxs("div", {
        className: "pl-modal",
        onClick: function (e) { e.stopPropagation(); },
        children: [
          // Toast
          toast && X.jsx("div", {
            className: "pl-toast",
            children: toast
          }),

          // Header：品牌 + 搜索 + 关闭
          X.jsxs("div", {
            className: "pl-header",
            children: [
              X.jsxs("div", {
                className: "pl-brand",
                children: [
                  SparklesIcon,
                  X.jsx("span", { children: "提示词库" })
                ]
              }),
              X.jsxs("div", {
                className: "pl-search",
                children: [
                  SearchFullIcon,
                  X.jsx("input", {
                    value: searchKeyword,
                    onChange: function (e) { setSearchKeyword(e.target.value); },
                    placeholder: "搜索标题或提示词内容"
                  })
                ]
              }),
              X.jsx("button", {
                onClick: onClose,
                className: "pl-close",
                children: CloseIcon
              })
            ]
          }),

          // Body：左侧导航 + 主区域
          X.jsxs("div", {
            className: "pl-body",
            children: [
              // 左侧导航
              X.jsxs("div", {
                className: "pl-sidebar",
                children: [
                  X.jsxs("button", {
                    onClick: function () { setActiveTab("mine"); },
                    className: "pl-nav-item " + (activeTab === "mine" ? "active" : ""),
                    children: [ListIcon(), "我的提示词"]
                  }),
                  X.jsxs("button", {
                    onClick: function () { setActiveTab("recent"); },
                    className: "pl-nav-item " + (activeTab === "recent" ? "active" : ""),
                    children: [ClockIcon(), "最近使用"]
                  })
                ]
              }),

              // 主区域
              X.jsxs("div", {
                className: "pl-main",
                children: [
                  // 工具栏：分类 + 新建
                  X.jsxs("div", {
                    className: "pl-toolbar",
                    children: [
                      X.jsx("div", {
                        className: "pl-filters",
                        children: [
                          { label: "全部", value: "" },
                          ...Ua
                        ].map(function (opt) {
                          let isActive = selectedCategory === opt.value;
                          return X.jsx("button", {
                            onClick: function () { setSelectedCategory(opt.value); },
                            className: "pl-filter " + (isActive ? "active" : ""),
                            children: opt.label
                          }, opt.value || "all");
                        })
                      }),
                      X.jsxs("button", {
                        onClick: startNew,
                        className: "pl-btn-primary",
                        children: [PlusIcon(), "新建提示词"]
                      })
                    ]
                  }),

                  // 卡片网格
                  X.jsx("div", {
                    className: "pl-content pl-custom-scrollbar",
                    children: displayCards.length === 0 ? X.jsx("div", {
                      className: "pl-empty",
                      children: activeTab === "recent" ? "还没有使用记录" : "暂无提示词，点击「新建提示词」添加"
                    }) : X.jsx("div", {
                      className: "pl-grid",
                      children: displayCards.map(function (card) {
                        return X.jsxs("div", {
                          key: card.id,
                          className: "pl-card",
                          onClick: function () { handleUse(card); },
                          children: [
                            // 第一行：标题 + 操作图标
                            X.jsxs("div", {
                              className: "pl-card-top",
                              children: [
                                X.jsx("div", {
                                  className: "pl-card-title",
                                  title: card.title,
                                  children: card.title || "(未命名)"
                                }),
                                X.jsxs("div", {
                                  className: "pl-card-actions",
                                  children: [
                                    X.jsx("button", {
                                      onClick: function (evt) { evt.stopPropagation(); startEdit(card.presetIndex); },
                                      className: "pl-icon-btn",
                                      title: "编辑",
                                      children: EditIcon()
                                    }),
                                    X.jsx("button", {
                                      onClick: function (evt) { evt.stopPropagation(); handleDelete(card.presetIndex); },
                                      className: "pl-icon-btn danger",
                                      title: "删除",
                                      children: TrashIcon()
                                    })
                                  ]
                                })
                              ]
                            }),
                            // 内容预览
                            X.jsx("p", {
                              className: "pl-card-body",
                              children: card.content || "(空)"
                            }),
                            // 底部：标签 + 使用按钮
                            X.jsxs("div", {
                              className: "pl-card-bottom",
                              children: [
                                X.jsx("span", {
                                  className: typeTagColor(card.category),
                                  children: typeLabel(card.category)
                                }),
                                X.jsx("button", {
                                  onClick: function (evt) { evt.stopPropagation(); handleUse(card); },
                                  className: "pl-use-btn",
                                  children: "使用"
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
      }),

      // 编辑/新建弹窗 modal
      isModalOpen && Un.createPortal(X.jsx("div", {
        className: "pl-edit-overlay",
        onClick: closeModal,
        children: X.jsxs("div", {
          className: "pl-edit-modal",
          onClick: function (e) { e.stopPropagation(); },
          children: [
            X.jsx("h3", {
              children: showNewForm ? "新建提示词" : "编辑提示词"
            }),
            // 标题 + 类型
            X.jsxs("div", {
              className: "pl-field-row",
              children: [
                X.jsxs("div", {
                  className: "pl-field",
                  style: { flex: 2 },
                  children: [
                    X.jsx("label", { children: "标题" }),
                    X.jsx("input", {
                      placeholder: "标题",
                      value: formData.title,
                      onChange: function (e) { setFormData(Object.assign({}, formData, { title: e.target.value })); }
                    })
                  ]
                }),
                X.jsxs("div", {
                  className: "pl-field",
                  style: { flex: 1 },
                  children: [
                    X.jsx("label", { children: "类型" }),
                    X.jsxs("select", {
                      value: formData.type,
                      onChange: function (e) { setFormData(Object.assign({}, formData, { type: e.target.value })); },
                      children: [
                        X.jsx("option", { value: "all", children: "通用" }),
                        X.jsx("option", { value: "text", children: "文本" }),
                        X.jsx("option", { value: "image", children: "生图" }),
                        X.jsx("option", { value: "video", children: "视频" })
                      ]
                    })
                  ]
                })
              ]
            }),
            // 提示词内容
            X.jsxs("div", {
              className: "pl-field",
              children: [
                X.jsx("label", { children: "提示词内容" }),
                X.jsx("textarea", {
                  placeholder: "提示词内容",
                  value: formData.prompt,
                  onChange: function (e) { setFormData(Object.assign({}, formData, { prompt: e.target.value })); }
                })
              ]
            }),
            // 底部按钮
            X.jsxs("div", {
              className: "pl-edit-actions",
              children: [
                !showNewForm ? X.jsx("button", {
                  onClick: function () { handleDelete(editingIndex); closeModal(); },
                  className: "pl-btn-danger",
                  children: "删除"
                }) : X.jsx("span", {}),
                X.jsxs("div", {
                  className: "pl-btn-group",
                  children: [
                    X.jsx("button", {
                      onClick: closeModal,
                      className: "pl-btn-secondary",
                      children: "取消"
                    }),
                    X.jsx("button", {
                      onClick: showNewForm ? saveNew : saveEdit,
                      className: "pl-btn-primary",
                      children: showNewForm ? "添加" : "保存"
                    })
                  ]
                })
              ]
            })
          ]
        })
      }), document.body)
    ]
  }), document.body);
}

/* ========== PromptDropdown 下拉 ========== */

function PromptDropdown({
  category: e,
  presetPrompts: t,
  onApply: n,
  onToast: r
}) {
  var _a = Y.useState(false), open = _a[0], setOpen = _a[1];
  var _b = Y.useState(false), libraryOpen = _b[0], setLibraryOpen = _b[1];
  var _c = Y.useState(""), searchText = _c[0], setSearchText = _c[1];
  var ref = Y.useRef(null);

  var enabled = t.filter(function (p) { return p.enabled !== false; });
  var matchFn = function (p) { return p.type === e || p.type === "all" || !p.type; };
  var sorted = enabled.filter(matchFn).concat(enabled.filter(function (p) { return !matchFn(p); }));
  var filtered = searchText.trim() ? sorted.filter(function (p) {
    return p.title.toLowerCase().includes(searchText.trim().toLowerCase());
  }) : sorted;

  Y.useEffect(function () {
    if (!open) return;
    var handler = function (evt) {
      ref.current && !ref.current.contains(evt.target) && setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return function () { document.removeEventListener("mousedown", handler, true); };
  }, [open]);

  var handleApply = function (content) {
    n(content);
    setOpen(false);
  };

  return X.jsxs("div", {
    className: "pd-container nodrag",
    ref: ref,
    children: [
      // 为 Dropdown 同样注入保障性的 CSS
      X.jsx("style", { children: injectedStyles }),
      X.jsx("div", { className: "pd-divider" }),
      X.jsx("button", {
        className: "pd-trigger",
        onClick: function (evt) { evt.stopPropagation(); setOpen(function (v) { return !v; }); setSearchText(""); },
        children: X.jsx("span", { children: "提示词" })
      }),
      open && X.jsxs("div", {
        className: "pd-popup nowheel nopan nodrag",
        onClick: function (evt) { evt.stopPropagation(); },
        children: [
          X.jsx("div", {
            className: "pd-search-wrap",
            children: X.jsx("input", {
              className: "pd-search-input",
              placeholder: "搜索...",
              value: searchText,
              onChange: function (evt) { setSearchText(evt.target.value); }
            })
          }),
          X.jsx("div", {
            className: "pd-list pl-custom-scrollbar",
            children: filtered.length === 0 ? X.jsx("div", {
              className: "pd-empty",
              children: "暂无提示词"
            }) : filtered.map(function (p, i) {
              return X.jsx("button", {
                className: "pd-item",
                onClick: function () { handleApply(p.prompt); },
                title: p.title,
                children: p.title
              }, "local-" + i);
            })
          }),
          X.jsx("div", {
            className: "pd-footer",
            children: X.jsxs("button", {
              className: "pd-footer-btn",
              onClick: function () { setLibraryOpen(true); setOpen(false); },
              children: [SparklesIcon, " 提示词库"]
            })
          })
        ]
      }),
      X.jsx(PromptLibrary, {
        open: libraryOpen,
        onClose: function () { setLibraryOpen(false); },
        onUse: function (content) { n(content); },
        onToast: r,
        defaultCategory: e,
        presetPrompts: t
      })
    ]
  });
}

export { PromptLibrary, PromptDropdown };
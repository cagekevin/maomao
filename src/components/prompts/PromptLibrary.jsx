// 提示词管理 UI 组件
// 替代 App.js 中的 qa (弹窗 ~2059) 和 Ja (下拉 ~2278)，纯本地模式
import { i as e } from "../../vendor/rolldown-runtime.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor/vendor.js";
import { Ua } from "../../config/options.js";
import { Ha } from "../../services/auth.js";
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

/* ========== 内联 SVG 图标 ========== */

var SparklesIcon = X.jsx("svg", {
  viewBox: "0 0 20 20", width: 20, height: 20, fill: "none",
  stroke: "currentColor", strokeWidth: 1.5,
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

/* ========== 工具 ========== */

function typeLabel(cat) {
  return { text: "文本", image: "生图", video: "视频" }[cat] || "通用";
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

  // 使用提示词
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

  // 编辑
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

  // 新建
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

  // 表单 UI
  var renderForm = function (onSave, onCancel, isNew) {
    return X.jsxs("div", {
      className: "bg-[#0d0c0c] border border-[#333] rounded-xl p-4 mb-4",
      children: [
        X.jsxs("h3", {
          className: "text-sm font-medium text-gray-300 mb-3",
          children: [isNew ? "新建提示词" : "编辑提示词"]
        }),
        X.jsxs("div", {
          className: "flex gap-2 mb-3",
          children: [
            X.jsx("input", {
              className: "flex-1 text-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-1.5 text-gray-300 focus:border-blue-500 outline-none",
              placeholder: "标题",
              value: formData.title,
              onChange: function (e) { setFormData(Object.assign({}, formData, { title: e.target.value })); }
            }),
            X.jsxs("select", {
              className: "text-xs bg-[#1a1a1a] border border-[#333] rounded px-2 py-1.5 text-gray-300 focus:border-blue-500 outline-none w-24",
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
        }),
        X.jsx("textarea", {
          className: "w-full text-xs bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 resize-none h-20 text-gray-400 focus:border-blue-500 outline-none",
          placeholder: "提示词内容",
          value: formData.prompt,
          onChange: function (e) { setFormData(Object.assign({}, formData, { prompt: e.target.value })); }
        }),
        X.jsxs("div", {
          className: "flex items-center justify-between mt-3",
          children: [
            !isNew && X.jsx("button", {
              onClick: function () { handleDelete(editingIndex); },
              className: "flex items-center gap-1 text-xs text-red-500 hover:text-red-400 px-2 py-1 hover:bg-red-500/10 rounded transition-colors",
              children: [TrashIcon(), " 删除"]
            }),
            X.jsxs("div", {
              className: "flex gap-2 ml-auto",
              children: [
                X.jsx("button", {
                  onClick: onCancel,
                  className: "text-xs px-3 py-1.5 text-gray-400 hover:text-gray-200 rounded bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors",
                  children: "取消"
                }),
                X.jsx("button", {
                  onClick: onSave,
                  className: "text-xs px-4 py-1.5 text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors",
                  children: isNew ? "添加" : "保存"
                })
              ]
            })
          ]
        })
      ]
    });
  };

  if (!open) return null;

  return Un.createPortal(X.jsx("div", {
    className: "fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 nowheel nopan nodrag",
    onClick: onClose,
    children: X.jsxs("div", {
      className: "relative w-[78vw] h-[82vh] max-w-[1600px] bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col overflow-hidden",
      onClick: function (e) { e.stopPropagation(); },
      children: [
        // Toast
        toast && X.jsx("div", {
          className: "absolute top-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] text-sm text-white shadow-2xl",
          children: toast
        }),

        // Header
        X.jsxs("div", {
          className: "shrink-0 flex items-center gap-4 px-5 h-14 border-b border-[#222]",
          children: [
            X.jsxs("div", {
              className: "flex items-center gap-2 pr-3 mr-1 border-r border-[#2a2a2a]",
              children: [
                X.jsx("span", { className: "w-5 h-5 text-white", children: SparklesIcon }),
                X.jsx("span", { className: "text-base font-semibold text-white whitespace-nowrap", children: "提示词库" })
              ]
            }),
            X.jsx("div", {
              className: "flex items-center gap-1",
              children: [{ key: "mine", label: "我的提示词" }, { key: "recent", label: "最近使用" }].map(function (tab) {
                return X.jsx("button", {
                  onClick: function () { setActiveTab(tab.key); },
                  className: "px-3.5 py-1.5 text-sm rounded-lg transition-colors " + (activeTab === tab.key ? "bg-[#2a2a2a] text-white font-medium" : "text-gray-400 hover:text-gray-200"),
                  children: tab.label
                }, tab.key);
              })
            }),
            X.jsxs("div", {
              className: "relative flex-1 max-w-md",
              children: [
                X.jsx("span", { className: "absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500", children: SearchIcon() }),
                X.jsx("input", {
                  value: searchKeyword,
                  onChange: function (e) { setSearchKeyword(e.target.value); },
                  placeholder: "搜索标题或提示词内容",
                  className: "w-full pl-7 pr-3 py-1.5 text-sm bg-transparent border-0 border-b border-[#333] rounded-none text-gray-200 placeholder:text-gray-600 focus:border-gray-400 outline-none"
                })
              ]
            }),
            X.jsxs("div", {
              className: "ml-auto flex items-center gap-3",
              children: [
                X.jsx("button", {
                  onClick: onClose,
                  className: "p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a] rounded-lg",
                  children: CloseIcon
                })
              ]
            })
          ]
        }),

        // 分类筛选
        X.jsx("div", {
          className: "shrink-0 flex items-center gap-2 px-5 pt-3 pb-1",
          children: Ua.map(function (opt) {
            return X.jsx("button", {
              onClick: function () { setSelectedCategory(opt.value); },
              className: "px-4 py-1.5 text-[13px] rounded-lg transition-colors " + (selectedCategory === opt.value ? "bg-white text-[#141414] font-medium" : "bg-[#1f1f1f] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200"),
              children: opt.label
            }, opt.value);
          })
        }),

        // 新建按钮
        X.jsx("div", {
          className: "shrink-0 px-5 pt-2 pb-1 flex items-center",
          children: X.jsx("button", {
            onClick: startNew,
            className: "flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1f1f1f] text-gray-300 hover:bg-[#2a2a2a] hover:text-blue-400 border border-[#333] rounded-lg transition-colors",
            children: [PlusIcon(), " 新建提示词"]
          })
        }),

        // 内容区域
        X.jsx("div", {
          className: "flex-1 overflow-y-auto custom-scrollbar p-5",
          children: [
            showNewForm && renderForm(saveNew, function () { setShowNewForm(false); }, true),
            editingIndex >= 0 && renderForm(saveEdit, function () { setEditingIndex(-1); }, false),
            displayCards.length === 0 && !showNewForm && editingIndex < 0 && X.jsx("div", {
              className: "h-full flex items-center justify-center text-sm text-gray-500",
              children: activeTab === "recent" ? "还没有使用记录" : "暂无提示词，点击「新建提示词」添加"
            }),
            displayCards.length > 0 && X.jsx("div", {
              className: "grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3",
              children: displayCards.map(function (card) {
                return X.jsxs("div", {
                  key: card.id,
                  className: "group relative rounded-xl overflow-hidden bg-[#1a1a1a] border border-transparent hover:border-white/30 transition-all cursor-pointer",
                  onClick: function () { handleUse(card); },
                  children: [
                    X.jsxs("div", {
                      className: "relative aspect-[3/4] bg-[#0d0c0c] overflow-hidden",
                      children: [
                        X.jsx("div", {
                          className: "w-full h-full flex items-center justify-center text-gray-700 text-3xl",
                          children: "\uD83D\uDCDD"
                        }),
                        X.jsx("div", {
                          className: "absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent"
                        }),
                        X.jsx("div", {
                          className: "absolute inset-0 px-3 py-8 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity pointer-events-none",
                          children: X.jsx("p", {
                            className: "text-[11px] text-gray-300 text-center leading-relaxed",
                            children: card.content || "(空)"
                          })
                        }),
                        X.jsxs("div", {
                          className: "absolute bottom-0 inset-x-0 p-2.5",
                          children: [
                            X.jsx("h3", {
                              className: "text-[13px] font-semibold text-white truncate drop-shadow",
                              title: card.title,
                              children: card.title || "(未命名)"
                            }),
                            X.jsx("div", {
                              className: "mt-1 flex items-center gap-1.5",
                              children: X.jsx("span", {
                                className: "px-1.5 py-0.5 text-[10px] rounded backdrop-blur-sm " + (card.category ? "bg-blue-500/30 text-blue-300" : "bg-white/15 text-white/90"),
                                children: typeLabel(card.category)
                              })
                            })
                          ]
                        }),
                        X.jsx("button", {
                          onClick: function (evt) { evt.stopPropagation(); startEdit(card.presetIndex); },
                          className: "absolute top-2 right-2 z-20 p-1.5 rounded-full bg-black/60 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white transition-all",
                          title: "编辑",
                          children: EditIcon()
                        }),
                        X.jsx("div", {
                          className: "absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity pointer-events-none",
                          children: X.jsxs("span", {
                            className: "flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white text-[#141414] rounded-lg shadow-lg pointer-events-auto",
                            children: [CheckIcon(), " 使用"]
                          })
                        })
                      ]
                    })
                  ]
                });
              })
            })
          ]
        })
      ]
    })
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
    className: "relative nodrag flex items-center",
    ref: ref,
    children: [
      X.jsx("div", { className: "w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5" }),
      X.jsx("button", {
        className: "flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[80px]",
        onClick: function (evt) { evt.stopPropagation(); setOpen(function (v) { return !v; }); setSearchText(""); },
        children: X.jsx("span", { className: "truncate", children: "提示词" })
      }),
      open && X.jsxs("div", {
        className: "absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl z-50 flex flex-col max-h-80 overflow-hidden nowheel nopan nodrag",
        onClick: function (evt) { evt.stopPropagation(); },
        children: [
          X.jsx("div", {
            className: "shrink-0 px-2 pt-2 pb-1",
            children: X.jsx("input", {
              className: "w-full text-[11px] bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-gray-300 placeholder:text-gray-600 focus:border-blue-500 outline-none",
              placeholder: "搜索...",
              value: searchText,
              onChange: function (evt) { setSearchText(evt.target.value); }
            })
          }),
          X.jsx("div", {
            className: "flex-1 overflow-y-auto custom-scrollbar px-2 pt-1 pb-2",
            children: filtered.length === 0 ? X.jsx("div", {
              className: "px-2 py-1.5 text-[11px] text-gray-600",
              children: "暂无提示词"
            }) : filtered.map(function (p, i) {
              return X.jsx("button", {
                className: "w-full block mb-1 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200",
                onClick: function () { handleApply(p.prompt); },
                title: p.title,
                children: p.title
              }, "local-" + i);
            })
          }),
          X.jsxs("div", {
            className: "shrink-0 flex items-center justify-between gap-2 px-2 py-1.5 border-t border-[#333]",
            children: [
              X.jsx("button", {
                className: "text-[10px] text-gray-400 hover:text-gray-200 transition-colors",
                onClick: function () { setLibraryOpen(true); setOpen(false); },
                children: "管理"
              }),
              X.jsxs("button", {
                className: "flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors",
                onClick: function () { setLibraryOpen(true); setOpen(false); },
                children: [SparklesIcon, " 提示词库"]
              })
            ]
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
